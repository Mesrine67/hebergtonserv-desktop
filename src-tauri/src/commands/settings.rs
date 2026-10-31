use crate::AppState;
use crate::errors::Result;
use crate::storage::Storage;
use crate::storage::models::SettingsDocument;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub async fn get_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<SettingsDocument> {
    let mut settings =
        Storage::read_json(&state.storage.settings_path, SettingsDocument::default())?;
    // Read Windows autostart registration, not the potentially stale JSON cache.
    settings.data.start_with_windows = app.autolaunch().is_enabled().map_err(|_| {
        crate::errors::app_error(
            "autostart_state_error",
            "Impossible de lire l'état du démarrage automatique Windows.",
        )
    })?;
    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    close_to_tray: bool,
    start_with_windows: bool,
) -> Result<()> {
    let mut document =
        Storage::read_json(&state.storage.settings_path, SettingsDocument::default())?;
    document.data.close_to_tray = close_to_tray;
    document.data.start_with_windows = start_with_windows;
    Storage::write_json(&state.storage.settings_path, &document, 1)?;
    Ok(())
}

#[tauri::command]
pub async fn enable_autostart(app: tauri::AppHandle) -> Result<()> {
    app.autolaunch().enable().map_err(|_| {
        crate::errors::app_error(
            "autostart_error",
            "Impossible d'activer le démarrage automatique.",
        )
    })?;
    Ok(())
}

#[tauri::command]
pub async fn disable_autostart(app: tauri::AppHandle) -> Result<()> {
    app.autolaunch().disable().map_err(|_| {
        crate::errors::app_error(
            "autostart_error",
            "Impossible de désactiver le démarrage automatique.",
        )
    })?;
    Ok(())
}
