//! Tauri command for running ad-hoc SQL queries against a saved connection.

use std::time::Instant;

use arrow::record_batch::RecordBatch;
use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::error::AppResult;
use crate::influx::convert::batches_to_json_rows;
use crate::influx::pool::ClientPool;
use crate::storage::history::{self, HistoryEntry};

#[derive(Debug, Clone, Serialize)]
pub struct ColumnMeta {
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnMeta>,
    pub rows: Vec<Value>,
    pub row_count: usize,
    pub elapsed_ms: u64,
    /// True if the backend truncated the result (row_count == row_limit).
    pub truncated: bool,
}

const DEFAULT_ROW_LIMIT: usize = 10_000;

#[tauri::command]
pub async fn run_query(
    pool: State<'_, ClientPool>,
    connection_id: String,
    sql: String,
    row_limit: Option<usize>,
) -> AppResult<QueryResult> {
    let limit = row_limit.unwrap_or(DEFAULT_ROW_LIMIT).max(1);

    let start = Instant::now();
    let outcome: AppResult<Vec<RecordBatch>> = pool
        .with_retry(&connection_id, |client| {
            let sql = sql.clone();
            async move {
                let mut guard = client.lock().await;
                guard.query(&sql).await
            }
        })
        .await;
    let elapsed_ms = start.elapsed().as_millis() as u64;

    let batches = match outcome {
        Ok(b) => b,
        Err(e) => {
            let _ = history::append(&HistoryEntry {
                id: history::new_id(),
                connection_id,
                sql,
                executed_at: history::now_ms(),
                success: false,
                elapsed_ms,
                row_count: None,
                error: Some(e.to_string()),
            });
            return Err(e);
        }
    };

    let columns: Vec<ColumnMeta> = batches
        .first()
        .map(|b| {
            b.schema()
                .fields()
                .iter()
                .map(|f| ColumnMeta {
                    name: f.name().clone(),
                    data_type: f.data_type().to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    let mut rows_collected = Vec::new();
    let mut total = 0usize;
    let mut truncated = false;
    for batch in batches {
        if total >= limit {
            truncated = true;
            break;
        }
        let take = (limit - total).min(batch.num_rows());
        let slice = batch.slice(0, take);
        rows_collected.push(slice);
        total += take;
        if total >= limit && batch.num_rows() > take {
            truncated = true;
        }
    }

    let rows = batches_to_json_rows(&rows_collected)?;

    let _ = history::append(&HistoryEntry {
        id: history::new_id(),
        connection_id,
        sql,
        executed_at: history::now_ms(),
        success: true,
        elapsed_ms,
        row_count: Some(total),
        error: None,
    });

    Ok(QueryResult {
        columns,
        rows,
        row_count: total,
        elapsed_ms,
        truncated,
    })
}

#[tauri::command]
pub fn list_history(limit: Option<usize>) -> AppResult<Vec<HistoryEntry>> {
    history::load_recent(limit)
}

#[tauri::command]
pub fn clear_history() -> AppResult<()> {
    history::clear()
}
