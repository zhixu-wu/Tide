//! Query history, stored as append-only NDJSON at
//! `~/.tide/history.jsonl`.
//!
//! We considered SQLite but chose append-only JSONL for now: the write path
//! is just `fs::open(append).write_all(json_line)`, there's no schema to
//! migrate, and a single user is unlikely to produce more history than a few
//! thousand lines a week. Switch to SQLite only if querying/filtering
//! pressure grows.

use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

const DIR_NAME: &str = ".tide";
const FILE_NAME: &str = "history.jsonl";
/// Cap history on read: displaying 5k entries is already a lot, and we load
/// them all into memory for the UI. The file on disk keeps growing; a future
/// task can trim or rotate.
const READ_LIMIT: usize = 5_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub connection_id: String,
    pub sql: String,
    /// Unix timestamp in milliseconds.
    pub executed_at: u64,
    pub success: bool,
    pub elapsed_ms: u64,
    pub row_count: Option<usize>,
    pub error: Option<String>,
}

fn history_path() -> AppResult<PathBuf> {
    let home = dirs_home()?
        .ok_or_else(|| AppError::Other("could not resolve home directory".into()))?;
    let dir = home.join(DIR_NAME);
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir.join(FILE_NAME))
}

fn dirs_home() -> AppResult<Option<PathBuf>> {
    if let Some(h) = std::env::var_os("HOME").map(PathBuf::from) {
        return Ok(Some(h));
    }
    if let Some(h) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
        return Ok(Some(h));
    }
    Ok(None)
}

static APPEND_LOCK: Mutex<()> = Mutex::new(());

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn append(entry: &HistoryEntry) -> AppResult<()> {
    let _g = APPEND_LOCK.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let path = history_path()?;
    let mut f = OpenOptions::new().create(true).append(true).open(path)?;
    let line = serde_json::to_string(entry)?;
    f.write_all(line.as_bytes())?;
    f.write_all(b"\n")?;
    Ok(())
}

/// Load the most recent `limit` entries (newest first).
pub fn load_recent(limit: Option<usize>) -> AppResult<Vec<HistoryEntry>> {
    let path = history_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let f = std::fs::File::open(path)?;
    let reader = BufReader::new(f);
    let mut entries: Vec<HistoryEntry> = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        // Skip malformed lines rather than fail the whole load: history is
        // best-effort telemetry, not authoritative data.
        if let Ok(e) = serde_json::from_str::<HistoryEntry>(&line) {
            entries.push(e);
        }
    }
    entries.reverse();
    let cap = limit.unwrap_or(READ_LIMIT).min(READ_LIMIT);
    entries.truncate(cap);
    Ok(entries)
}

pub fn clear() -> AppResult<()> {
    let _g = APPEND_LOCK.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let path = history_path()?;
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}
