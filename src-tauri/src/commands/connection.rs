//! Tauri commands for connection CRUD + test_connection.

use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::influx::flight::FlightSqlClient;
use crate::models::{Connection, ConnectionInput, TestConnectionResult};
use crate::storage::{connections as store, keychain};

#[tauri::command]
pub fn list_connections() -> AppResult<Vec<Connection>> {
    store::load_all()
}

#[tauri::command]
pub fn save_connection(input: ConnectionInput) -> AppResult<Connection> {
    if input.name.trim().is_empty() {
        return Err(AppError::InvalidInput("name is required".into()));
    }
    if input.host.trim().is_empty() {
        return Err(AppError::InvalidInput("host is required".into()));
    }
    if input.token.trim().is_empty() {
        return Err(AppError::InvalidInput("token is required".into()));
    }
    let database = input
        .database
        .as_deref()
        .map(str::trim)
        .unwrap_or_default();
    if database.is_empty() {
        return Err(AppError::InvalidInput(
            "database is required (InfluxDB 3.x FlightSQL needs it)".into(),
        ));
    }

    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let conn = Connection {
        id: id.clone(),
        name: input.name,
        host: input.host,
        port: input.port,
        database: Some(database.to_string()),
        use_tls: input.use_tls,
    };

    // Token first — if keychain write fails we don't want an orphan JSON entry.
    keychain::save_token(&id, &input.token)?;
    store::upsert(conn)
}

#[tauri::command]
pub fn delete_connection(id: String) -> AppResult<()> {
    store::remove(&id)?;
    // Best-effort: delete the keychain entry even if it was already gone.
    let _ = keychain::delete_token(&id);
    Ok(())
}

/// Dry-run connection test using the token from the provided input (not yet
/// saved). Used by the "Test Connection" button in the new-connection dialog.
#[tauri::command]
pub async fn test_connection(input: ConnectionInput) -> AppResult<TestConnectionResult> {
    let conn = Connection {
        id: "__test__".to_string(),
        name: input.name.clone(),
        host: input.host.clone(),
        port: input.port,
        database: input.database.clone(),
        use_tls: input.use_tls,
    };

    match FlightSqlClient::connect(&conn, &input.token).await {
        Ok(mut client) => match client.ping().await {
            Ok(()) => Ok(TestConnectionResult {
                ok: true,
                message: "Connection OK".into(),
                server_version: None,
            }),
            Err(e) => Ok(TestConnectionResult {
                ok: false,
                message: format!("query failed: {e}"),
                server_version: None,
            }),
        },
        Err(e) => Ok(TestConnectionResult {
            ok: false,
            message: format!("connect failed: {e}"),
            server_version: None,
        }),
    }
}

/// Test an existing saved connection (token fetched from keychain).
#[tauri::command]
pub async fn test_saved_connection(id: String) -> AppResult<TestConnectionResult> {
    let conn = store::get(&id)?;
    let token = keychain::load_token(&id)?;

    match FlightSqlClient::connect(&conn, &token).await {
        Ok(mut client) => match client.ping().await {
            Ok(()) => Ok(TestConnectionResult {
                ok: true,
                message: "Connection OK".into(),
                server_version: None,
            }),
            Err(e) => Ok(TestConnectionResult {
                ok: false,
                message: format!("query failed: {e}"),
                server_version: None,
            }),
        },
        Err(e) => Ok(TestConnectionResult {
            ok: false,
            message: format!("connect failed: {e}"),
            server_version: None,
        }),
    }
}
