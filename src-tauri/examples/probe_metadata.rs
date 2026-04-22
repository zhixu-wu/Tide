//! Probe metadata queries end-to-end using the same stack the Tauri commands
//! will use: FlightSqlClient + metadata module.
//!
//! Reads `.env` for host/port/token, hard-codes db=monitoring (matching the
//! user-confirmed database).

use std::fs;
use std::path::PathBuf;

use tide_lib::influx::flight::FlightSqlClient;
use tide_lib::influx::metadata;
use tide_lib::models::Connection;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env_path = locate_env()?;
    let (host, port, token) = parse_env(&env_path)?;
    let use_tls = port == 443 || port == 8443;

    let conn = Connection {
        id: "probe".into(),
        name: "probe".into(),
        host,
        port,
        database: Some("monitoring".into()),
        use_tls,
    };

    println!("→ {}", conn.endpoint());
    let mut client = FlightSqlClient::connect(&conn, &token).await?;
    println!("✓ connected");

    let schemas = metadata::list_schemas(&mut client).await?;
    println!("✓ schemas ({}):", schemas.len());
    for s in &schemas {
        println!("    {}", s);
    }

    let target_schema = schemas.first().cloned().unwrap_or_else(|| "iox".into());
    let tables = metadata::list_tables(&mut client, Some(&target_schema)).await?;
    println!(
        "✓ tables in schema '{}' ({}):",
        target_schema,
        tables.len()
    );
    for t in tables.iter().take(10) {
        println!("    {}.{} ({})", t.schema, t.name, t.table_type);
    }
    if tables.len() > 10 {
        println!("    … {} more", tables.len() - 10);
    }

    if let Some(first) = tables.first() {
        let cols = metadata::list_columns(&mut client, &first.schema, &first.name).await?;
        println!(
            "✓ columns of {}.{} ({}):",
            first.schema,
            first.name,
            cols.len()
        );
        for c in cols.iter().take(15) {
            println!(
                "    {:<20} {:<20} null={}",
                c.name, c.data_type, c.nullable
            );
        }
        if cols.len() > 15 {
            println!("    … {} more", cols.len() - 15);
        }
    }

    Ok(())
}

fn locate_env() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    for base in [cwd.clone(), cwd.join(".."), cwd.join("../..")] {
        let p = base.join(".env");
        if p.exists() {
            return Ok(p);
        }
    }
    Err("could not locate .env".into())
}

fn parse_env(path: &PathBuf) -> Result<(String, u16, String), String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut host = None;
    let mut port = None;
    let mut token = None;
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((k, v)) = line.split_once('=') else {
            continue;
        };
        let v = v.trim().trim_matches('"').trim_matches('\'');
        match k.trim() {
            "host" => host = Some(v.to_string()),
            "port" => port = Some(v.parse::<u16>().map_err(|e| e.to_string())?),
            "token" => token = Some(v.to_string()),
            _ => {}
        }
    }
    Ok((
        host.ok_or("missing host")?,
        port.ok_or("missing port")?,
        token.ok_or("missing token")?,
    ))
}
