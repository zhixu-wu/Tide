//! FlightSQL client for InfluxDB 3.x.
//!
//! InfluxDB 3.x exposes queries over Arrow Flight / FlightSQL on its gRPC
//! endpoint (default port 8181 for Core/Enterprise, 443 for Cloud). This
//! module wraps the minimal surface we need:
//!
//! - Build a `FlightSqlServiceClient` with Bearer token auth.
//! - Execute a SQL string and stream back Arrow `RecordBatch`es.
//! - Run a lightweight "ping" for connection testing.

use std::str::FromStr;
use std::time::Duration;

use arrow::record_batch::RecordBatch;
use arrow_flight::sql::client::FlightSqlServiceClient;
use futures::TryStreamExt;
use tonic::transport::{Channel, ClientTlsConfig, Endpoint};

use crate::error::{AppError, AppResult};
use crate::models::Connection;

pub struct FlightSqlClient {
    inner: FlightSqlServiceClient<Channel>,
    database: Option<String>,
}

impl FlightSqlClient {
    /// Connect to the InfluxDB 3.x FlightSQL endpoint using the provided token.
    pub async fn connect(conn: &Connection, token: &str) -> AppResult<Self> {
        let endpoint_url = conn.endpoint();

        let mut endpoint = Endpoint::from_str(&endpoint_url)
            .map_err(|e| AppError::Connection(format!("invalid endpoint {endpoint_url}: {e}")))?
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .http2_keep_alive_interval(Duration::from_secs(30));

        if conn.use_tls {
            let tls = ClientTlsConfig::new().with_native_roots();
            endpoint = endpoint
                .tls_config(tls)
                .map_err(|e| AppError::Connection(format!("tls config: {e}")))?;
        }

        let channel = endpoint
            .connect()
            .await
            .map_err(|e| AppError::Connection(format!("connect {endpoint_url}: {e}")))?;

        let mut inner = FlightSqlServiceClient::new(channel);
        inner.set_header("authorization", format!("Bearer {token}"));

        if let Some(db) = conn.database.as_deref() {
            if !db.is_empty() {
                inner.set_header("database", db.to_string());
            }
        }

        Ok(Self {
            inner,
            database: conn.database.clone(),
        })
    }

    /// Execute a SQL query and collect all result batches into memory.
    ///
    /// For very large results, prefer a streaming variant (todo).
    pub async fn query(&mut self, sql: &str) -> AppResult<Vec<RecordBatch>> {
        if let Some(db) = self.database.as_deref() {
            if !db.is_empty() {
                self.inner.set_header("database", db.to_string());
            }
        }

        let flight_info = self
            .inner
            .execute(sql.to_string(), None)
            .await
            .map_err(|e| AppError::Query(e.to_string()))?;

        let mut batches = Vec::new();
        for endpoint in flight_info.endpoint {
            let ticket = endpoint
                .ticket
                .ok_or_else(|| AppError::Query("flight endpoint missing ticket".into()))?;

            let stream = self
                .inner
                .do_get(ticket)
                .await
                .map_err(|e| AppError::Query(e.to_string()))?;

            let collected: Vec<RecordBatch> = stream
                .try_collect()
                .await
                .map_err(|e| AppError::Query(e.to_string()))?;
            batches.extend(collected);
        }
        Ok(batches)
    }

    /// Lightweight health check — runs `SELECT 1`.
    pub async fn ping(&mut self) -> AppResult<()> {
        let _ = self.query("SELECT 1").await?;
        Ok(())
    }
}
