//! Metadata queries against `information_schema` — used by the resource
//! browser (schemas / tables / columns).

use serde::Serialize;

use crate::error::AppResult;
use crate::influx::convert::batches_first_column_strings;
use crate::influx::flight::FlightSqlClient;

#[derive(Debug, Clone, Serialize)]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    /// InfluxDB 3.x marks each column as "tag", "field", "timestamp" via the
    /// `iox::column_type` metadata. It's not always present; we surface it
    /// when available.
    pub influx_type: Option<String>,
}

const EXCLUDED_SCHEMAS: &[&str] = &["information_schema", "system"];

pub async fn list_schemas(client: &mut FlightSqlClient) -> AppResult<Vec<String>> {
    let batches = client
        .query(
            "SELECT schema_name FROM information_schema.schemata \
             ORDER BY schema_name",
        )
        .await?;
    let mut names = batches_first_column_strings(&batches)?;
    names.retain(|n| !EXCLUDED_SCHEMAS.contains(&n.as_str()));
    Ok(names)
}

pub async fn list_tables(
    client: &mut FlightSqlClient,
    schema: Option<&str>,
) -> AppResult<Vec<TableInfo>> {
    // Exclude information_schema / system unless the caller explicitly asks.
    let sql = match schema {
        Some(s) => format!(
            "SELECT table_schema, table_name, table_type \
             FROM information_schema.tables \
             WHERE table_schema = '{}' \
             ORDER BY table_name",
            s.replace('\'', "''")
        ),
        None => format!(
            "SELECT table_schema, table_name, table_type \
             FROM information_schema.tables \
             WHERE table_schema NOT IN ('{}') \
             ORDER BY table_schema, table_name",
            EXCLUDED_SCHEMAS.join("','")
        ),
    };

    let batches = client.query(&sql).await?;

    let mut tables = Vec::new();
    for batch in &batches {
        use arrow::array::StringArray;
        let schema_col = batch
            .column(0)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or_else(|| {
                crate::error::AppError::Query("table_schema is not a string column".into())
            })?;
        let name_col = batch
            .column(1)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or_else(|| {
                crate::error::AppError::Query("table_name is not a string column".into())
            })?;
        let type_col = batch
            .column(2)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or_else(|| {
                crate::error::AppError::Query("table_type is not a string column".into())
            })?;

        for row in 0..batch.num_rows() {
            tables.push(TableInfo {
                schema: schema_col.value(row).to_string(),
                name: name_col.value(row).to_string(),
                table_type: type_col.value(row).to_string(),
            });
        }
    }
    Ok(tables)
}

pub async fn list_columns(
    client: &mut FlightSqlClient,
    schema: &str,
    table: &str,
) -> AppResult<Vec<ColumnInfo>> {
    let sql = format!(
        "SELECT column_name, data_type, is_nullable \
         FROM information_schema.columns \
         WHERE table_schema = '{}' AND table_name = '{}' \
         ORDER BY ordinal_position",
        schema.replace('\'', "''"),
        table.replace('\'', "''"),
    );

    let batches = client.query(&sql).await?;

    let mut cols = Vec::new();
    for batch in &batches {
        use arrow::array::StringArray;
        let name_col = batch
            .column(0)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or_else(|| {
                crate::error::AppError::Query("column_name is not a string column".into())
            })?;
        let type_col = batch
            .column(1)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or_else(|| {
                crate::error::AppError::Query("data_type is not a string column".into())
            })?;
        let nullable_col = batch
            .column(2)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or_else(|| {
                crate::error::AppError::Query("is_nullable is not a string column".into())
            })?;

        for row in 0..batch.num_rows() {
            cols.push(ColumnInfo {
                name: name_col.value(row).to_string(),
                data_type: type_col.value(row).to_string(),
                nullable: nullable_col.value(row).eq_ignore_ascii_case("YES"),
                influx_type: None,
            });
        }
    }
    Ok(cols)
}
