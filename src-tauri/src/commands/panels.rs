use crate::AppState;
use crate::errors::{Result, app_error};
use crate::providers::http::{AccountApi, ApiClient};
use crate::providers::pterodactyl::PterodactylProvider;
use crate::providers::wisp::WispProvider;
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
    pub provider: String,
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
        .find(|panel| panel.base_url.trim_end_matches('/') == base.as_str().trim_end_matches('/'))
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
    let url = url::validate_panel_url(&panel.base_url, panel.allow_local)?;
    url::verify_resolved_host(&url, panel.allow_local).await?;
    let token = credential_entry(&panel.id)?.get_password().map_err(|_| {
        app_error(
            "api_token",
            "Configurez le jeton API du panneau dans les paramètres.",
        )
    })?;
    let detection_accept =
        if panel.provider == "wisp" && panel.pterodactyl_version == "wisp-v2-experimental" {
            "application/vnd.wisp.v2+json"
        } else {
            "application/vnd.wisp.v1+json"
        };
    let detected = ApiClient::new(&panel.base_url, &token, detection_accept, panel.allow_local)?
        .get_account_with_api()
        .await?
        .1;
    let detected_provider = match detected {
        AccountApi::Wisp => ProviderKind::Wisp.as_str(),
        AccountApi::Pterodactyl => ProviderKind::Pterodactyl.as_str(),
    };
    let mut effective_panel = panel.clone();
    effective_panel.provider = detected_provider.to_string();
    let provider = provider_for(&effective_panel)?;
    let account = provider.account().await?;
    let api_keys = provider.list_api_keys().await?;
    let ssh_keys = provider.list_ssh_keys().await?;
    let result = PanelCheckResult {
        panel_id: panel.id.clone(),
        status: "ok".to_string(),
        message: format!("Compte vérifié : {}", account.display_name),
        provider: detected_provider.to_string(),
        account_label: Some(account.display_name.clone()),
        api_keys_supported: api_keys.supported,
        ssh_keys_supported: ssh_keys.supported,
    };
    let mut updated = document;
    if let Some(existing) = updated.data.panels.iter_mut().find(|panel| panel.id == id) {
        existing.status = Some(result.status.clone());
        existing.provider = detected_provider.to_string();
        existing.account_label = result.account_label.clone();
        existing.last_checked_at = Some(chrono::Utc::now().to_rfc3339());
    }
    Storage::write_json(&state.storage.panels_path, &updated, 1)?;
    Ok(result)
}

#[derive(Debug, Clone, Serialize)]
pub struct PanelAccountSummary {
    pub panel_id: String,
    pub provider: String,
    pub base_url: String,
    pub account: crate::providers::models::PanelAccount,
}

#[tauri::command]
pub async fn get_panel_account(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<PanelAccountSummary> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|panel| panel.id == id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let account = provider_for(&panel)?.account().await?;
    Ok(PanelAccountSummary {
        panel_id: panel.id,
        provider: panel.provider,
        base_url: panel.base_url,
        account,
    })
}

#[tauri::command]
pub async fn list_panel_servers(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Vec<crate::providers::models::PanelServer>> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|panel| panel.id == id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let result = provider_for(&panel)?.list_servers().await;
    match &result {
        Ok(servers) => crate::diagnostics::record(
            "info",
            "panel_servers",
            "list_ok",
            if servers.is_empty() {
                "Liste de serveurs vide"
            } else {
                "Liste de serveurs reçue"
            },
        ),
        Err(error) => crate::diagnostics::record(
            "error",
            "panel_servers",
            error.code(),
            "Impossible de lister les serveurs",
        ),
    }
    result
}

#[tauri::command]
pub async fn list_panel_server_subusers(
    state: tauri::State<'_, AppState>,
    id: String,
    identifier: String,
) -> Result<crate::providers::Capability<Vec<crate::providers::models::PanelSubuser>>> {
    if identifier.is_empty()
        || identifier.len() > 128
        || !identifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(app_error("api_config", "Identifiant serveur invalide."));
    }
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|panel| panel.id == id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let url = url::validate_panel_url(&panel.base_url, panel.allow_local)?;
    url::verify_resolved_host(&url, panel.allow_local).await?;
    provider_for(&panel)?
        .list_server_subusers(&identifier)
        .await
}

#[tauri::command]
pub async fn get_panel_server_resources(
    state: tauri::State<'_, AppState>,
    id: String,
    identifier: String,
) -> Result<crate::providers::models::PanelServerResources> {
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|panel| panel.id == id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let result = provider_for(&panel)?.server_resources(&identifier).await;
    if let Err(error) = &result {
        crate::diagnostics::record(
            "warning",
            "panel_resources",
            error.code(),
            "Ressources indisponibles",
        );
    }
    result
}

/// Normalize only the two documented response keys; never log the URL or token.
fn console_socket_url(data: &serde_json::Value) -> Option<&str> {
    data.get("socket")
        .or_else(|| data.get("url"))
        .and_then(serde_json::Value::as_str)
}

#[derive(Debug, Clone, Serialize)]
pub struct ConsoleCredentials {
    pub socket: String,
    pub token: String,
}

/// Ephemeral Wings credentials: never persist, print, cache or send to diagnostics.
#[tauri::command]
pub async fn get_panel_console_credentials(
    state: tauri::State<'_, AppState>,
    id: String,
    identifier: String,
) -> Result<ConsoleCredentials> {
    let result = get_panel_console_credentials_inner(state, id, identifier).await;
    match &result {
        Ok(_) => crate::diagnostics::record(
            "info",
            "console_credentials",
            "credentials_ok",
            "Accès à la console autorisé",
        ),
        Err(error) => crate::diagnostics::record(
            "error",
            "console_credentials",
            error.code(),
            "Accès à la console impossible",
        ),
    }
    result
}

async fn get_panel_console_credentials_inner(
    state: tauri::State<'_, AppState>,
    id: String,
    identifier: String,
) -> Result<ConsoleCredentials> {
    if identifier.is_empty()
        || identifier.len() > 128
        || !identifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(app_error(
            "api_invalid_request",
            "Identifiant serveur invalide.",
        ));
    }
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|item| item.id == id)
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let token = credential_entry(&panel.id)?
        .get_password()
        .map_err(|_| app_error("api_token", "Clé Client API indisponible."))?;
    let accept = if panel.provider == "wisp" {
        if panel.pterodactyl_version == "wisp-v2-experimental" {
            "application/vnd.wisp.v2+json"
        } else {
            "application/vnd.wisp.v1+json"
        }
    } else {
        "application/json"
    };
    let client = ApiClient::new(&panel.base_url, &token, accept, panel.allow_local)?;
    let response: serde_json::Value = client
        .send_json(
            reqwest::Method::GET,
            &format!("/api/client/servers/{identifier}/websocket"),
            None,
        )
        .await?;
    let data = response.get("data").unwrap_or(&response);
    // WISP legacy returns {url, token}; Pterodactyl uses {data:{socket, token}}.
    // Both endpoint shapes are read-only; the resulting URL is validated below.
    let socket = console_socket_url(data)
        .ok_or_else(|| app_error("api_invalid_response", "Adresse WebSocket manquante."))?;
    let ephemeral = data
        .get("token")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| app_error("api_invalid_response", "Jeton WebSocket manquant."))?;
    let socket_url = reqwest::Url::parse(socket)
        .map_err(|_| app_error("api_invalid_response", "Adresse WebSocket invalide."))?;
    if socket_url.scheme() != "wss"
        || socket_url.host_str().is_none()
        || !socket_url.username().is_empty()
        || socket_url.password().is_some()
        || socket_url.query().is_some()
        || ephemeral.len() > 8192
        || ephemeral.is_empty()
    {
        return Err(app_error(
            "api_invalid_response",
            "WebSocket Wings non sécurisé ou jeton invalide.",
        ));
    }
    // Reject private/loopback Wings targets before opening a native WebSocket.
    let mut probe = socket_url.clone();
    probe
        .set_scheme("https")
        .map_err(|_| app_error("api_invalid_response", "Adresse WebSocket invalide."))?;
    crate::security::url::verify_resolved_host(&probe, panel.allow_local).await?;
    Ok(ConsoleCredentials {
        socket: socket.to_string(),
        token: ephemeral.to_string(),
    })
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ResourceRequest {
    pub key: String,
    pub identifier: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResourceResult {
    pub key: String,
    pub resources: Option<crate::providers::models::PanelServerResources>,
    pub error_code: Option<String>,
}

/// Fetch up to one page of resources in groups of four. Avoid the previous
/// 12-request burst, which could trigger rate limits or stall weaker panels.
#[tauri::command]
pub async fn get_panel_resources_batch(
    state: tauri::State<'_, AppState>,
    id: String,
    requests: Vec<ResourceRequest>,
) -> Result<Vec<ResourceResult>> {
    if requests.len() > 16
        || requests.iter().any(|item| {
            item.key.is_empty()
                || item.key.len() > 128
                || item.identifier.is_empty()
                || item.identifier.len() > 128
                || !item
                    .identifier
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
    {
        return Err(app_error(
            "api_invalid_request",
            "Liste de ressources invalide.",
        ));
    }
    let document = Storage::read_json(&state.storage.panels_path, PanelsDocument::default())?;
    let panel = document
        .data
        .panels
        .iter()
        .find(|panel| panel.id == id)
        .cloned()
        .ok_or_else(|| app_error("panel_not_found", "Panneau introuvable."))?;
    let mut results = Vec::with_capacity(requests.len());
    for chunk in requests.chunks(4) {
        let mut jobs = tokio::task::JoinSet::new();
        for item in chunk {
            let panel = panel.clone();
            let key = item.key.clone();
            let identifier = item.identifier.clone();
            jobs.spawn(async move {
                let result = match provider_for(&panel) {
                    Ok(provider) => provider.server_resources(&identifier).await,
                    Err(error) => Err(error),
                };
                match result {
                    Ok(resources) => ResourceResult {
                        key,
                        resources: Some(resources),
                        error_code: None,
                    },
                    Err(error) => ResourceResult {
                        key,
                        resources: None,
                        error_code: Some(error.code().to_string()),
                    },
                }
            });
        }
        while let Some(result) = jobs.join_next().await {
            match result {
                Ok(result) => {
                    if let Some(code) = &result.error_code {
                        crate::diagnostics::record(
                            "warning",
                            "panel_resources",
                            code,
                            "Échec du chargement de ressources",
                        );
                    }
                    results.push(result);
                }
                Err(_) => crate::diagnostics::record(
                    "error",
                    "panel_resources",
                    "task_failed",
                    "Tâche de requête interrompue",
                ),
            }
        }
    }
    let failures = results
        .iter()
        .filter(|result| result.error_code.is_some())
        .count();
    crate::diagnostics::record_batch_summary(results.len(), failures);
    if failures == 0 {
        crate::diagnostics::record(
            "info",
            "panel_resources",
            "batch_ok",
            "Lecture des ressources terminée",
        );
    } else {
        crate::diagnostics::record(
            "warning",
            "panel_resources",
            "batch_partial",
            "Certaines ressources sont indisponibles",
        );
    }
    Ok(results)
}

#[cfg(test)]
mod console_credentials_tests {
    use super::*;

    #[test]
    fn accepts_wisp_url_and_pterodactyl_socket_responses() {
        let wisp = serde_json::json!({"url": "wss://node.example.test/ws", "token": "test"});
        let pterodactyl =
            serde_json::json!({"data": {"socket": "wss://node.example.test/ws", "token": "test"}});
        assert_eq!(
            console_socket_url(&wisp),
            Some("wss://node.example.test/ws")
        );
        assert_eq!(
            console_socket_url(&pterodactyl["data"]),
            Some("wss://node.example.test/ws")
        );
        assert_eq!(
            console_socket_url(&serde_json::json!({"token": "test"})),
            None
        );
    }
}
