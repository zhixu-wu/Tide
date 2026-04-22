//! JSON-on-disk storage for non-sensitive connection fields.
//!
//! Lives at `~/.tide/connections.json`. Tokens are NOT stored here —
//! see `storage::keychain`.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::error::{AppError, AppResult};
use crate::models::Connection;

const DIR_NAME: &str = ".tide";
const FILE_NAME: &str = "connections.json";

fn config_dir() -> AppResult<PathBuf> {
    let home =
        dirs_home()?.ok_or_else(|| AppError::Other("could not resolve home directory".into()))?;
    let dir = home.join(DIR_NAME);
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

fn config_path() -> AppResult<PathBuf> {
    Ok(config_dir()?.join(FILE_NAME))
}

fn dirs_home() -> AppResult<Option<PathBuf>> {
    // `dirs` crate would be cleaner, but we can avoid the dep.
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        return Ok(Some(home));
    }
    if let Some(userprofile) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
        return Ok(Some(userprofile));
    }
    Ok(None)
}

/// Guards disk IO against concurrent writes from multiple commands.
static LOCK: Mutex<()> = Mutex::new(());

pub fn load_all() -> AppResult<Vec<Connection>> {
    let _g = LOCK.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let path = config_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    let list: Vec<Connection> = serde_json::from_str(&raw)?;
    Ok(list)
}

pub fn save_all(conns: &[Connection]) -> AppResult<()> {
    let _g = LOCK.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let path = config_path()?;
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(conns)?;
    fs::write(&tmp, body)?;
    fs::rename(tmp, path)?;
    Ok(())
}

/// Insert or update (by id). Returns the updated connection.
pub fn upsert(conn: Connection) -> AppResult<Connection> {
    let mut list = load_all()?;
    if let Some(existing) = list.iter_mut().find(|c| c.id == conn.id) {
        *existing = conn.clone();
    } else {
        list.push(conn.clone());
    }
    save_all(&list)?;
    Ok(conn)
}

pub fn remove(id: &str) -> AppResult<()> {
    let mut list = load_all()?;
    let before = list.len();
    list.retain(|c| c.id != id);
    if list.len() == before {
        return Err(AppError::NotFound(format!("connection {id} not found")));
    }
    save_all(&list)?;
    Ok(())
}

pub fn get(id: &str) -> AppResult<Connection> {
    load_all()?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::NotFound(format!("connection {id} not found")))
}
