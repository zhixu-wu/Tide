//! Secure token storage backed by the OS keychain.
//!
//! We use the `keyring` crate so tokens never touch plain-text files:
//!   - macOS → Keychain
//!   - Windows → Credential Manager
//!   - Linux → Secret Service (later)
//!
//! Each connection stores its token under service `tide` and username equal
//! to the connection id.

use keyring::Entry;

use crate::error::AppResult;

const SERVICE: &str = "tide";

fn entry(connection_id: &str) -> AppResult<Entry> {
    Ok(Entry::new(SERVICE, connection_id)?)
}

pub fn save_token(connection_id: &str, token: &str) -> AppResult<()> {
    entry(connection_id)?.set_password(token)?;
    Ok(())
}

pub fn load_token(connection_id: &str) -> AppResult<String> {
    Ok(entry(connection_id)?.get_password()?)
}

pub fn delete_token(connection_id: &str) -> AppResult<()> {
    // NoEntry on delete is not an error for our purposes — the caller just
    // wanted the token gone.
    match entry(connection_id)?.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}
