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
    let client = pool.get(&connection_id).await?;
    let mut guard = client.lock().await;
    match metadata::list_schemas(&mut guard).await {
        Ok(v) => Ok(v),
        Err(e) => {
            drop(guard);
            pool.drop(&connection_id).await;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn list_tables(
    pool: State<'_, ClientPool>,
    connection_id: String,
    schema: Option<String>,
) -> AppResult<Vec<TableInfo>> {
    let client = pool.get(&connection_id).await?;
    let mut guard = client.lock().await;
    match metadata::list_tables(&mut guard, schema.as_deref()).await {
        Ok(v) => Ok(v),
        Err(e) => {
            drop(guard);
            pool.drop(&connection_id).await;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn list_columns(
    pool: State<'_, ClientPool>,
    connection_id: String,
    schema: String,
    table: String,
) -> AppResult<Vec<ColumnInfo>> {
    let client = pool.get(&connection_id).await?;
    let mut guard = client.lock().await;
    match metadata::list_columns(&mut guard, &schema, &table).await {
        Ok(v) => Ok(v),
        Err(e) => {
            drop(guard);
            pool.drop(&connection_id).await;
            Err(e)
        }
    }
}
