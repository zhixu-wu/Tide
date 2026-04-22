//! Tauri commands for resource browser metadata.

use tauri::State;

use crate::error::AppResult;
use crate::influx::metadata::{self, ColumnInfo, TableInfo};
use crate::influx::pool::ClientPool;

#[tauri::command]
pub async fn list_schemas(
    pool: State<'_, ClientPool>,
    connection_id: String,
) -> AppResult<Vec<String>> {
    pool.with_retry(&connection_id, |client| async move {
        let mut guard = client.lock().await;
        metadata::list_schemas(&mut guard).await
    })
    .await
}

#[tauri::command]
pub async fn list_tables(
    pool: State<'_, ClientPool>,
    connection_id: String,
    schema: Option<String>,
) -> AppResult<Vec<TableInfo>> {
    let schema = schema.as_deref().map(str::to_string);
    pool.with_retry(&connection_id, |client| {
        let schema = schema.clone();
        async move {
            let mut guard = client.lock().await;
            metadata::list_tables(&mut guard, schema.as_deref()).await
        }
    })
    .await
}

#[tauri::command]
pub async fn list_columns(
    pool: State<'_, ClientPool>,
    connection_id: String,
    schema: String,
    table: String,
) -> AppResult<Vec<ColumnInfo>> {
    pool.with_retry(&connection_id, |client| {
        let schema = schema.clone();
        let table = table.clone();
        async move {
            let mut guard = client.lock().await;
            metadata::list_columns(&mut guard, &schema, &table).await
        }
    })
    .await
}
