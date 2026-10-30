use crate::AppState;
use crate::errors::{Result, app_error};
use crate::providers::pterodactyl::PterodactylProvider;
use crate::providers::wisp::WispProvider;
use crate::providers::{PanelProvider, ProviderKind};
use crate::security::url;
use crate::storage::Storage;
use crate::storage::models::{PanelConfig, PanelsDocument};
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct PanelCheckResult {
    pub panel_id: String,
    pub status: String,
    pub message: String,
    pub account_label: Option<String>,
    pub api_keys_supported: bool,
    pub ssh_keys_supported: bool,
}

fn provider_for(panel: &PanelConfig) -> Box<dyn PanelProvider> {
    let base_url = panel.base_url.clone();
    let token = String::new();
    let allow_local = panel.allow_local;
    let version = panel.pterodactyl_version.clone();
    if panel.provider == ProviderKind::Pterodactyl.as_str() {
        Box::new(PterodactylProvider::new(
            &base_url,
            &token,
            allow_local,
            &version,
        ))
    } else {
        Box::new(WispProvider::new(&base_url, &token, allow_local, &version))
    }
}

#[tauri::command]
pub async fn list_panels(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<PanelConfig>> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    Ok(document.data.panels)
}

#[tauri::command]
pub async fn save_panel(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    panel: PanelConfig,
) -> Result<()> {
    let mut document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    if let Some(existing) = document
        .data
        .panels
        .iter_mut()
        .find(|panel| panel.id == panel.id)
    {
        *existing = panel;
    } else {
        document.data.panels.push(panel);
    }
    Storage::write_json(&state.storage.panels_path, &document, 1)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_panel(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<()> {
    let mut document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    document.data.panels.retain(|panel| panel.id != id);
    Storage::write_json(&state.storage.panels_path, &document, 1)?;
    Ok(())
}

#[tauri::command]
pub async fn check_panel(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<PanelCheckResult> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|panel| panel.id == id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let provider = provider_for(&panel);
    let url = url::validate_panel_url(&panel.base_url, panel.allow_local)?;
    url::verify_resolved_host(&url, panel.allow_local).await?;
    let account = provider.account().await?;
    let api_keys = provider.list_api_keys().await?;
    let ssh_keys = provider.list_ssh_keys().await?;
    let result = PanelCheckResult {
        panel_id: panel.id.clone(),
        status: "ok".to_string(),
        message: format!("Compte vérifié : {}", account.display_name),
        account_label: Some(account.display_name.clone()),
        api_keys_supported: api_keys.supported,
        ssh_keys_supported: ssh_keys.supported,
    };
    let mut updated = document;
    if let Some(existing) = updated.data.panels.iter_mut().find(|panel| panel.id == id) {
        existing.status = Some(result.status.clone());
        existing.account_label = result.account_label.clone();
        existing.last_checked_at = Some(chrono::Utc::now().to_rfc3339());
    }
    Storage::write_json(&state.storage.panels_path, &updated, 1)?;
    Ok(result)
}
