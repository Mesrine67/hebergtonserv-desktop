// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

pub mod commands;
pub mod errors;
pub mod providers;
pub mod security;
pub mod ssh;
pub mod state;
pub mod storage;

use crate::state::AppState;
use crate::storage::Storage;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_single_instance::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let home_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
            let storage = Storage::new(
                app.path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from(".")),
                app.path()
                    .app_log_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from(".")),
                home_dir.clone(),
                home_dir.join(".ssh"),
            );
            app.manage(AppState::new(storage));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::ssh::list_ssh_keys,
            commands::ssh::generate_ssh_key,
            commands::ssh::import_public_key,
            commands::ssh::read_ssh_public_key,
            commands::ssh::delete_ssh_key,
            commands::ssh::list_ssh_trash,
            commands::ssh::test_ssh_connection,
            commands::ssh::open_ssh_connection,
            commands::ssh::scan_host_key,
            commands::ssh::append_host_key,
            commands::ssh::read_ssh_config,
            commands::ssh::upsert_ssh_config,
            commands::ssh::delete_ssh_config,
            commands::ssh::import_ssh_config_profiles,
            commands::ssh::agent_status,
            commands::ssh::agent_identities,
            commands::ssh::agent_add_identity,
            commands::ssh::agent_remove_identity,
            commands::panels::list_panels,
            commands::panels::save_panel,
            commands::panels::delete_panel,
            commands::panels::check_panel,
            commands::profiles::list_ssh_profiles,
            commands::profiles::save_ssh_profile,
            commands::profiles::delete_ssh_profile,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::security::get_security_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
