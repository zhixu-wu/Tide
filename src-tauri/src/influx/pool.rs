//! In-memory pool of live FlightSQL clients, keyed by connection id.
//!
//! Building a new `FlightSqlClient` requires a TLS handshake (~150ms against
//! our prod env), so we cache one per connection and reuse it. If a cached
//! client fails, the caller may invalidate it via `drop` and retry.

use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::influx::flight::FlightSqlClient;
use crate::models::Connection;
use crate::storage::{connections as store, keychain};

type SharedClient = Arc<Mutex<FlightSqlClient>>;

#[derive(Default)]
pub struct ClientPool {
    clients: Mutex<HashMap<String, SharedClient>>,
}

impl ClientPool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Get (or lazily create) a client for the given connection id.
    pub async fn get(&self, connection_id: &str) -> AppResult<SharedClient> {
        {
            let map = self.clients.lock().await;
            if let Some(c) = map.get(connection_id) {
                return Ok(c.clone());
            }
        }

        let conn: Connection = store::get(connection_id)?;
        let token = keychain::load_token(connection_id)?;
        let client = FlightSqlClient::connect(&conn, &token).await?;
        let shared = Arc::new(Mutex::new(client));

        let mut map = self.clients.lock().await;
        // race: another task may have inserted while we were connecting.
        Ok(map
            .entry(connection_id.to_string())
            .or_insert_with(|| shared.clone())
            .clone())
    }

    /// Drop the cached client for a connection (call on error or on delete).
    pub async fn drop(&self, connection_id: &str) {
        let mut map = self.clients.lock().await;
        map.remove(connection_id);
    }

    /// Run `op` with a cached client; if it fails with a likely-transport
    /// error (broken pipe / reset / timeout), drop the client and retry once.
    ///
    /// The closure receives a &mut FlightSqlClient already locked. Callers
    /// should NOT hold the mutex themselves — this wrapper handles it.
    pub async fn with_retry<T, F, Fut>(&self, connection_id: &str, op: F) -> AppResult<T>
    where
        F: Fn(SharedClient) -> Fut,
        Fut: Future<Output = AppResult<T>>,
    {
        let client = self.get(connection_id).await?;
        match op(client.clone()).await {
            Ok(v) => Ok(v),
            Err(e) if is_transport_error(&e) => {
                // Connection looks stale (keep-alive ping failed, proxy
                // dropped us, etc.) — rebuild and try once more.
                self.drop(connection_id).await;
                let fresh = self.get(connection_id).await?;
                op(fresh).await
            }
            Err(e) => Err(e),
        }
    }
}

fn is_transport_error(e: &AppError) -> bool {
    match e {
        AppError::Transport(_) => true,
        AppError::Status(status) => matches!(
            status.code(),
            tonic::Code::Unavailable
                | tonic::Code::Aborted
                | tonic::Code::DeadlineExceeded
                | tonic::Code::Cancelled
        ),
        AppError::Connection(_) => true,
        AppError::Query(msg) => {
            // tonic tucks transport errors inside a generic Status; the
            // stringified message is our last resort.
            let m = msg.to_lowercase();
            m.contains("broken pipe")
                || m.contains("connection reset")
                || m.contains("connection closed")
                || m.contains("transport error")
                || m.contains("h2 protocol error")
        }
        _ => false,
    }
}
