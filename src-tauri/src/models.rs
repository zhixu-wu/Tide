use serde::{Deserialize, Serialize};

/// A saved InfluxDB 3.x connection profile.
///
/// The token is NOT stored in this struct — it lives in the OS keychain and is
/// fetched on demand using `Connection.id`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: Option<String>,
    #[serde(default)]
    pub use_tls: bool,
}

impl Connection {
    /// gRPC/FlightSQL endpoint URL.
    pub fn endpoint(&self) -> String {
        let scheme = if self.use_tls { "https" } else { "http" };
        format!("{}://{}:{}", scheme, self.host, self.port)
    }
}

/// Input payload used when creating or updating a connection. Token is
/// provided here and then moved into the keychain.
#[derive(Debug, Clone, Deserialize)]
pub struct ConnectionInput {
    pub id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub token: String,
    pub database: Option<String>,
    #[serde(default)]
    pub use_tls: bool,
}

/// Result of a `test_connection` call.
#[derive(Debug, Clone, Serialize)]
pub struct TestConnectionResult {
    pub ok: bool,
    pub message: String,
    pub server_version: Option<String>,
}
