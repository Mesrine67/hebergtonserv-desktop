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
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_window_state::StateFlags;

/// Ask Windows 11 DWM for its native rounded window corners. The compositor
/// ignores this preference on unsupported versions; CSS clips the webview too.
#[cfg(target_os = "windows")]
fn prefer_native_rounded_corners(window: &tauri::WebviewWindow) {
    #[link(name = "dwmapi")]
    unsafe extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut std::ffi::c_void,
            attribute: u32,
            value: *const std::ffi::c_void,
            value_size: u32,
        ) -> i32;
    }
    if let Ok(hwnd) = window.hwnd() {
        let corner_preference: i32 = 2; // DWMWCP_ROUND
        // DWMWA_WINDOW_CORNER_PREFERENCE = 33, Windows 11.
        let _ = unsafe {
            DwmSetWindowAttribute(
                hwnd.0,
                33,
                (&raw const corner_preference).cast(),
                std::mem::size_of_val(&corner_preference) as u32,
            )
        };
    }
}

#[tauri::command]
fn toggle_app_window_maximize(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Fenêtre principale introuvable".to_string())?;

    if window
        .is_maximized()
        .map_err(|error| format!("Lecture de l’état de la fenêtre impossible : {error}"))?
    {
        window
            .unmaximize()
            .map_err(|error| format!("Restauration de la fenêtre impossible : {error}"))
    } else {
        window
            .maximize()
            .map_err(|error| format!("Agrandissement de la fenêtre impossible : {error}"))
    }
}

#[derive(serde::Serialize)]
struct LocalIdentity {
    username: String,
    hostname: String,
}

#[tauri::command]
fn get_local_identity() -> LocalIdentity {
    LocalIdentity {
        username: std::env::var("USERNAME").unwrap_or_else(|_| "Session locale".into()),
        hostname: std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Appareil Windows".into()),
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_single_instance::Builder::default()
                .callback(|app, _args, _cwd| {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::VISIBLE
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(
            tauri_plugin_snap_layout::init()
                .button_id("snap-btn")
                .padding_all(0)
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                prefer_native_rounded_corners(&window);
            }
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
            storage.ensure_dirs().ok();
            app.manage(AppState::new(storage));

            // Startup via Windows autostart can request a hidden launch.
            // Explicit normal launches must remain visible even if autostart is enabled.
            if std::env::args_os().any(|arg| arg == "--minimized")
                && let Some(window) = app.get_webview_window("main")
            {
                let _ = window.hide();
            }

            // Tray icon
            let show_item = MenuItem::with_id(app, "show", "Afficher", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../icons/32x32.png"
                ))?)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Respect the user setting; otherwise allow the application to close.
                let should_hide = window
                    .app_handle()
                    .try_state::<AppState>()
                    .and_then(|state| {
                        Storage::read_json(
                            &state.storage.settings_path,
                            crate::storage::models::SettingsDocument::default(),
                        )
                        .ok()
                    })
                    .map(|settings| settings.data.close_to_tray)
                    .unwrap_or(false);
                if should_hide {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_local_identity,
            toggle_app_window_maximize,
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
            commands::panels::login_wisp,
            commands::panels::save_panel,
            commands::panels::delete_panel,
            commands::panels::set_panel_token,
            commands::panels::panel_token_configured,
            commands::panels::check_panel,
            commands::panels::get_panel_account,
            commands::panels::list_panel_servers,
            commands::panels::get_panel_server_resources,
            commands::panels::create_panel_api_key,
            commands::panels::create_panel_ssh_key,
            commands::panels::revoke_panel_api_key,
            commands::panels::delete_panel_ssh_key,
            commands::profiles::list_ssh_profiles,
            commands::profiles::save_ssh_profile,
            commands::profiles::delete_ssh_profile,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::security::get_security_state,
            commands::settings::enable_autostart,
            commands::settings::disable_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
