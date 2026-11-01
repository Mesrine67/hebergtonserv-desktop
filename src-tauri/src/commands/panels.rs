use crate::AppState;
use crate::errors::{Result, app_error};
use crate::providers::pterodactyl::PterodactylProvider;
use crate::providers::wisp::WispProvider;
use crate::providers::http::{AccountApi, ApiClient};
use crate::providers::{PanelProvider, ProviderKind};
use crate::security::url;
use crate::storage::Storage;
use crate::storage::models::{PanelConfig, PanelsDocument};
use keyring::Entry;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PanelCheckResult {
    pub panel_id: String,
    pub status: String,
    pub message: String,
    pub account_label: Option<String>,
    pub api_keys_supported: bool,
    pub ssh_keys_supported: bool,
}

fn credential_entry(panel_id: &str) -> Result<Entry> {
    Entry::new("hebergtonserv-desktop.panel", panel_id).map_err(|_| {
        app_error(
            "panel_keyring",
            "Le coffre de secrets Windows est indisponible.",
        )
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct WispLoginResult {
    pub panel_id: String,
    pub display_name: String,
    pub email: String,
    pub provider: String,
}

#[tauri::command]
pub async fn login_wisp(
    state: tauri::State<'_, AppState>,
    base_url: String,
    token: String,
) -> Result<WispLoginResult> {
    if token.trim().is_empty() || token.len() > 4096 {
        return Err(app_error("api_token", "Jeton API vide ou trop long."));
    }
    let base = url::validate_panel_url(&base_url, false)?;
    url::verify_resolved_host(&base, false).await?;
    let client = ApiClient::new(
        base.as_str(),
        token.trim(),
        "application/vnd.wisp.v1+json",
        false,
    )?;
    let (account, detected_api) = client.get_account_with_api().await?;
    let provider_name = match detected_api {
        AccountApi::Wisp => "wisp",
        AccountApi::Pterodactyl => "pterodactyl",
    };
    let mut document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel_id = document
        .data
        .panels
        .iter()
        .find(|panel| {
            panel.base_url.trim_end_matches('/') == base.as_str().trim_end_matches('/')
        })
        .map(|panel| panel.id.clone())
        .unwrap_or_else(|| format!("{provider_name}-{}", uuid::Uuid::new_v4()));
    let name = if base
        .host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case("manage.hebergtonserv.com"))
    {
        "HébergTonServ".to_string()
    } else {
        base.host_str().unwrap_or("WISP").to_string()
    };
    let panel = PanelConfig {
        id: panel_id.clone(),
        name,
        provider: provider_name.to_string(),
        base_url: base.as_str().trim_end_matches('/').to_string(),
        pterodactyl_version: "auto".to_string(),
        allow_local: false,
        status: Some("ok".to_string()),
        account_label: Some(account.display_name.clone()),
        last_checked_at: Some(chrono::Utc::now().to_rfc3339()),
    };
    credential_entry(&panel_id)?
        .set_password(token.trim())
        .map_err(|_| {
            app_error(
                "panel_keyring",
                "Impossible de sauvegarder le jeton dans le coffre d'identifiants Windows.",
            )
        })?;
    if let Some(existing) = document
        .data
        .panels
        .iter_mut()
        .find(|panel| panel.id == panel_id)
    {
        *existing = panel;
    } else {
        document.data.panels.push(panel);
    }
    Storage::write_json(&state.storage.panels_path, &document, 1)?;
    Ok(WispLoginResult {
        panel_id,
        display_name: account.display_name,
        email: account.email,
        provider: provider_name.to_string(),
    })
}

fn provider_for(panel: &PanelConfig) -> Result<Box<dyn PanelProvider>> {
    let base_url = panel.base_url.clone();
    let token = credential_entry(&panel.id)?.get_password().map_err(|_| {
        app_error(
            "api_token",
            "Configurez le jeton API du panneau dans les paramètres.",
        )
    })?;
    if token.trim().is_empty() {
        return Err(app_error("api_token", "Le jeton API du panneau est vide."));
    }
    let allow_local = panel.allow_local;
    let version = panel.pterodactyl_version.clone();
    if panel.provider == ProviderKind::Pterodactyl.as_str() {
        Ok(Box::new(PterodactylProvider::new(
            &base_url,
            &token,
            allow_local,
            &version,
        )))
    } else {
        Ok(Box::new(WispProvider::new(
            &base_url,
            &token,
            allow_local,
            &version,
        )))
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
        .find(|existing| existing.id == panel.id)
    {
        *existing = panel;
    } else {
        document.data.panels.push(panel);
    }
    Storage::write_json(&state.storage.panels_path, &document, 1)?;
    Ok(())
}

#[tauri::command]
pub async fn set_panel_token(
    state: tauri::State<'_, AppState>,
    id: String,
    token: String,
) -> Result<()> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    if !document.data.panels.iter().any(|p| p.id == id) {
        return Err(app_error("panel_not_found", "Panneau introuvable."));
    }
    if token.trim().is_empty() || token.len() > 4096 {
        return Err(app_error("api_token", "Jeton API vide ou trop long."));
    }
    credential_entry(&id)?
        .set_password(token.trim())
        .map_err(|_| {
            app_error(
                "panel_keyring",
                "Impossible de sauvegarder le jeton dans le coffre Windows.",
            )
        })
}

#[tauri::command]
pub async fn panel_token_configured(state: tauri::State<'_, AppState>, id: String) -> Result<bool> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    if !document.data.panels.iter().any(|p| p.id == id) {
        return Err(app_error("panel_not_found", "Panneau introuvable."));
    }
    Ok(credential_entry(&id)?
        .get_password()
        .map(|s| !s.is_empty())
        .unwrap_or(false))
}

#[tauri::command]
pub async fn delete_panel(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<()> {
    let mut document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    document.data.panels.retain(|panel| panel.id != id);
    if let Ok(entry) = credential_entry(&id) {
        let _ = entry.delete_credential();
    }
    Storage::write_json(&state.storage.panels_path, &document, 1)?;
    Ok(())
}

#[tauri::command]
pub async fn create_panel_api_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    panel_id: String,
    description: String,
    allowed_ips: Vec<String>,
) -> Result<crate::providers::models::CreatedPanelApiKey> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|p| p.id == panel_id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let provider = provider_for(&panel)?;
    let result = provider.create_api_key(&description, &allowed_ips).await?;
    if !result.supported {
        return Err(app_error(
            "not_supported",
            result
                .message
                .unwrap_or_else(|| "Non supporté.".to_string()),
        ));
    }
    result
        .value
        .ok_or_else(|| app_error("api_error", "Réponse invalide."))
}

#[tauri::command]
pub async fn create_panel_ssh_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    panel_id: String,
    name: String,
    public_key: String,
) -> Result<crate::providers::models::PanelSshKey> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|p| p.id == panel_id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let provider = provider_for(&panel)?;
    let result = provider.create_ssh_key(&name, &public_key).await?;
    if !result.supported {
        return Err(app_error(
            "not_supported",
            result
                .message
                .unwrap_or_else(|| "Non supporté.".to_string()),
        ));
    }
    result
        .value
        .ok_or_else(|| app_error("api_error", "Réponse invalide."))
}

#[tauri::command]
pub async fn revoke_panel_api_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    panel_id: String,
    identifier: String,
) -> Result<()> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|p| p.id == panel_id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let provider = provider_for(&panel)?;
    let result = provider.revoke_api_key(&identifier).await?;
    if !result.supported {
        return Err(app_error(
            "not_supported",
            result
                .message
                .unwrap_or_else(|| "Non supporté.".to_string()),
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_panel_ssh_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    panel_id: String,
    fingerprint: String,
) -> Result<()> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|p| p.id == panel_id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let provider = provider_for(&panel)?;
    let result = provider.delete_ssh_key(&fingerprint).await?;
    if !result.supported {
        return Err(app_error(
            "not_supported",
            result
                .message
                .unwrap_or_else(|| "Non supporté.".to_string()),
        ));
    }
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
    let provider = provider_for(&panel)?;
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
