//! In-memory pool of live FlightSQL clients, keyed by connection id.
//!
//! Building a new `FlightSqlClient` requires a TLS handshake (~150ms against
//! our prod env), so we cache one per connection and reuse it. If a cached
//! client fails, the caller may invalidate it via `drop` and retry.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::error::AppResult;
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
}
