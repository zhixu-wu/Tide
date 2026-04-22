//! Connection probe — reads host/port/token from the project root `.env`
//! and attempts a FlightSQL connection + `SELECT 1` ping.
//!
//! Usage:
//!   cargo run --example probe_connection
//!
//! This example is NOT part of the application; it exists only to verify
//! that `FlightSqlClient` can reach a real InfluxDB 3.x instance.

use std::fs;
use std::path::PathBuf;

use tide_lib::influx::flight::FlightSqlClient;
use tide_lib::models::Connection;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env_path = locate_env()?;
    println!("Reading credentials from {}", env_path.display());
    let (host, port, token) = parse_env(&env_path)?;
    let use_tls = port == 443 || port == 8443;

    let conn = Connection {
        id: "probe".into(),
        name: "probe".into(),
        host: host.clone(),
        port,
        database: Some("monitoring".into()),
        use_tls,
    };

    println!(
        "→ endpoint: {}  tls={}  token=***{}",
        conn.endpoint(),
        use_tls,
        token.chars().rev().take(4).collect::<String>().chars().rev().collect::<String>()
    );

    let start = std::time::Instant::now();
    let mut client = match FlightSqlClient::connect(&conn, &token).await {
        Ok(c) => {
            println!("✓ connected in {:?}", start.elapsed());
            c
        }
        Err(e) => {
            eprintln!("✗ connect failed: {e}");
            std::process::exit(1);
        }
    };

    let start = std::time::Instant::now();
    match client.ping().await {
        Ok(()) => {
            println!("✓ SELECT 1 ok in {:?}", start.elapsed());
        }
        Err(e) => {
            eprintln!("✗ SELECT 1 failed: {e}");
            std::process::exit(2);
        }
    }

    // Bonus — list tables in the current database via information_schema.
    match client
        .query("SELECT table_schema, table_name, table_type FROM information_schema.tables ORDER BY table_schema, table_name")
        .await
    {
        Ok(batches) => {
            let total_rows: usize = batches.iter().map(|b| b.num_rows()).sum();
            println!("✓ information_schema.tables returned {total_rows} row(s)");
            for b in &batches {
                for row in 0..b.num_rows().min(30) {
                    let cells: Vec<String> = (0..b.num_columns())
                        .map(|c| {
                            arrow::util::display::array_value_to_string(b.column(c), row)
                                .unwrap_or_else(|_| "?".into())
                        })
                        .collect();
                    println!("  {}", cells.join(" | "));
                }
                if b.num_rows() > 30 {
                    println!("  … {} more", b.num_rows() - 30);
                }
            }
        }
        Err(e) => {
            eprintln!("(skipping) information_schema.tables failed: {e}");
        }
    }

    Ok(())
}

fn locate_env() -> Result<PathBuf, String> {
    // example is run from src-tauri/, so walk up one level.
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    for base in [cwd.clone(), cwd.join(".."), cwd.join("../..")] {
        let p = base.join(".env");
        if p.exists() {
            return Ok(p);
        }
    }
    Err("could not locate .env in cwd or parent dirs".into())
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
        let k = k.trim();
        let v = v.trim().trim_matches('"').trim_matches('\'');
        match k {
            "host" => host = Some(v.to_string()),
            "port" => port = Some(v.parse::<u16>().map_err(|e| e.to_string())?),
            "token" => token = Some(v.to_string()),
            _ => {}
        }
    }
    Ok((
        host.ok_or("missing `host` in .env")?,
        port.ok_or("missing `port` in .env")?,
        token.ok_or("missing `token` in .env")?,
    ))
}
