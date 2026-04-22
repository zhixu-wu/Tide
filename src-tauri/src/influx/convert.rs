//! Convert Arrow `RecordBatch`es into plain JSON rows (`Vec<Map<String, Value>>`).
//!
//! This is the fast-path format for sending small, display-oriented result
//! sets (metadata queries, preview rows) to the frontend. For large result
//! sets we will stream Arrow IPC instead — but that's a later milestone.

use arrow::array::Array;
use arrow::record_batch::RecordBatch;
use arrow::util::display::{ArrayFormatter, FormatOptions};
use serde_json::{Map, Value};

use crate::error::AppResult;

pub fn batches_to_json_rows(batches: &[RecordBatch]) -> AppResult<Vec<Value>> {
    let mut rows: Vec<Value> = Vec::new();
    let opts = FormatOptions::default();
    for batch in batches {
        let schema = batch.schema();
        let formatters: Vec<ArrayFormatter> = batch
            .columns()
            .iter()
            .map(|c| ArrayFormatter::try_new(c.as_ref(), &opts))
            .collect::<Result<_, _>>()?;

        for row_idx in 0..batch.num_rows() {
            let mut obj = Map::with_capacity(batch.num_columns());
            for (col_idx, field) in schema.fields().iter().enumerate() {
                let col = batch.column(col_idx);
                let v = if col.is_null(row_idx) {
                    Value::Null
                } else {
                    Value::String(formatters[col_idx].value(row_idx).to_string())
                };
                obj.insert(field.name().clone(), v);
            }
            rows.push(Value::Object(obj));
        }
    }
    Ok(rows)
}

/// Collect the first string column from the first row of each batch.
/// Used for queries like `SELECT schema_name FROM information_schema.schemata`.
pub fn batches_first_column_strings(batches: &[RecordBatch]) -> AppResult<Vec<String>> {
    let opts = FormatOptions::default();
    let mut out = Vec::new();
    for batch in batches {
        if batch.num_columns() == 0 {
            continue;
        }
        let col = batch.column(0);
        let fmt = ArrayFormatter::try_new(col.as_ref(), &opts)?;
        for row in 0..batch.num_rows() {
            if !col.is_null(row) {
                out.push(fmt.value(row).to_string());
            }
        }
    }
    Ok(out)
}
