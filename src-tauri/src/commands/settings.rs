use crate::AppState;
use crate::errors::Result;
use crate::storage::Storage;
use crate::storage::models::{SettingsData, SettingsDocument};
use serde::Serialize;
use tauri::State;

#[tauri::command]
pub async fn get_settings(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<SettingsDocument> {
    Ok(Storage::read_json(
        &state.storage.settings_path,
        SettingsDocument::default(),
    )?)
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
