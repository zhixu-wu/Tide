pub mod commands;
pub mod error;
pub mod influx;
pub mod models;
pub mod storage;

use commands::connection::{
    delete_connection, list_connections, save_connection, test_connection, test_saved_connection,
};
use commands::metadata::{list_columns, list_schemas, list_tables};
use commands::query::{clear_history, list_history, run_query};
use influx::pool::ClientPool;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ClientPool::new())
        .invoke_handler(tauri::generate_handler![
            // connection
            list_connections,
            save_connection,
            delete_connection,
            test_connection,
            test_saved_connection,
            // metadata
            list_schemas,
            list_tables,
            list_columns,
            // query
            run_query,
            list_history,
            clear_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
