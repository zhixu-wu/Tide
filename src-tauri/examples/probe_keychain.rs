//! Verify that `keyring` can write/read/delete on this machine.
//! Run: cargo run --example probe_keychain

use tide_lib::storage::keychain;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let id = "__probe__";
    println!("saving token for id={id} …");
    keychain::save_token(id, "hello-secret")?;
    println!("✓ save ok");

    let back = keychain::load_token(id)?;
    println!("✓ load ok: {}", if back == "hello-secret" { "match" } else { "MISMATCH" });

    keychain::delete_token(id)?;
    println!("✓ delete ok");

    Ok(())
}
