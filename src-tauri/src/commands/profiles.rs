use crate::AppState;
use crate::errors::Result;
use crate::storage::Storage;
use crate::storage::models::{ProfilesDocument, SshProfile};

#[tauri::command]
pub async fn list_ssh_profiles(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SshProfile>> {
    let document = Storage::read_json(&state.storage.profiles_path, ProfilesDocument::default())?;
    Ok(document.data.profiles)
}

#[tauri::command]
pub async fn save_ssh_profile(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    profile: SshProfile,
) -> Result<()> {
    let mut document =
        Storage::read_json(&state.storage.profiles_path, ProfilesDocument::default())?;
    if let Some(existing) = document
        .data
        .profiles
        .iter_mut()
        .find(|existing| existing.id == profile.id)
    {
        *existing = profile;
    } else {
        document.data.profiles.push(profile);
    }
    Storage::write_json(&state.storage.profiles_path, &document, 1)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_ssh_profile(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<()> {
    let mut document =
        Storage::read_json(&state.storage.profiles_path, ProfilesDocument::default())?;
    document.data.profiles.retain(|profile| profile.id != id);
    Storage::write_json(&state.storage.profiles_path, &document, 1)?;
    Ok(())
}
