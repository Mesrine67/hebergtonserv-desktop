use crate::AppState;
use crate::errors::{Result, app_error};
use crate::ssh::models::{
    AgentIdentity, PublicKeyContent, SshConfigEntry, SshConfigSnapshot, SshConnectionResult,
    SshKeySummary, TrashEntry,
};
use crate::ssh::{AgentStatus, GenerateKeyInput, TestConnectionInput};
use crate::storage::models::SshProfile;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestConnectionCommandInput {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub key_name: Option<String>,
}

#[tauri::command]
pub async fn list_ssh_keys(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SshKeySummary>> {
    Ok(crate::ssh::scan_ssh_dir(&state.storage.ssh_dir))
}

#[tauri::command]
pub async fn generate_ssh_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    input: GenerateKeyInput,
) -> Result<SshKeySummary> {
    crate::ssh::generate_ssh_key(&input, &state.storage.ssh_dir)
}

#[tauri::command]
pub async fn import_public_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
    public_key: String,
) -> Result<PublicKeyContent> {
    crate::ssh::import_public_key_text(&state.storage.ssh_dir, &name, &public_key)
}

#[tauri::command]
pub async fn read_ssh_public_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<PublicKeyContent> {
    crate::ssh::read_public_key(&state.storage.ssh_dir, &id)
}

#[tauri::command]
pub async fn delete_ssh_key(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    trash_id: String,
) -> Result<TrashEntry> {
    crate::ssh::delete_ssh_key(&trash_id, &state.storage.app_data_dir)
}

#[tauri::command]
pub async fn list_ssh_trash(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<TrashEntry>> {
    Ok(crate::ssh::list_ssh_trash(&state.storage.app_data_dir))
}

#[tauri::command]
pub async fn test_ssh_connection(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
    input: TestConnectionCommandInput,
) -> Result<SshConnectionResult> {
    let connection_input = TestConnectionInput {
        host: &input.host,
        port: input.port,
        username: &input.username,
        auth_method: &input.auth_method,
        key_name: input.key_name.as_deref(),
    };
    crate::ssh::test_ssh_connection(&connection_input).await
}

#[tauri::command]
pub async fn open_ssh_connection(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
    input: TestConnectionCommandInput,
) -> Result<()> {
    let connection_input = TestConnectionInput {
        host: &input.host,
        port: input.port,
        username: &input.username,
        auth_method: &input.auth_method,
        key_name: input.key_name.as_deref(),
    };
    crate::ssh::open_ssh_connection(&connection_input).await
}

#[tauri::command]
pub async fn scan_host_key(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
    host: String,
    port: u16,
) -> Result<crate::ssh::known_hosts::HostKeyEntry> {
    crate::ssh::scan_host_key(&host, port).await
}

#[tauri::command]
pub async fn append_host_key(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
    host: String,
    port: u16,
    entry: crate::ssh::known_hosts::HostKeyEntry,
) -> Result<()> {
    crate::ssh::append_host_key(&host, port, &entry)
}

#[tauri::command]
pub async fn read_ssh_config(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
) -> Result<SshConfigSnapshot> {
    let path = crate::ssh::open_ssh_config_path()
        .ok_or_else(|| app_error("ssh_path_error", "Répertoire SSH introuvable."))?;
    Ok(crate::ssh::read_ssh_config(&path))
}

#[tauri::command]
pub async fn upsert_ssh_config(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
    entry: SshConfigEntry,
) -> Result<SshConfigSnapshot> {
    let path = crate::ssh::open_ssh_config_path()
        .ok_or_else(|| app_error("ssh_path_error", "Répertoire SSH introuvable."))?;
    crate::ssh::upsert_ssh_config(&path, &entry)
}

#[tauri::command]
pub async fn delete_ssh_config(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
    host: String,
) -> Result<bool> {
    let path = crate::ssh::open_ssh_config_path()
        .ok_or_else(|| app_error("ssh_path_error", "Répertoire SSH introuvable."))?;
    crate::ssh::delete_ssh_config_entry(&path, &host)
}

#[tauri::command]
pub async fn import_ssh_config_profiles(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
) -> Result<Vec<SshProfile>> {
    let path = crate::ssh::open_ssh_config_path()
        .ok_or_else(|| app_error("ssh_path_error", "Répertoire SSH introuvable."))?;
    crate::ssh::config::import_ssh_config_profiles(&path)
}

#[tauri::command]
pub async fn agent_status(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
) -> Result<AgentStatus> {
    crate::ssh::agent_service_status().await
}

#[tauri::command]
pub async fn agent_identities(
    _app: tauri::AppHandle,
    _state: tauri::State<'_, AppState>,
) -> Result<Vec<AgentIdentity>> {
    crate::ssh::agent_identities().await
}

#[tauri::command]
pub async fn agent_add_identity(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    key_name: String,
) -> Result<()> {
    let ssh_dir = state.storage.ssh_dir.clone();
    crate::ssh::agent_add_identity(&ssh_dir, &key_name).await
}

#[tauri::command]
pub async fn agent_remove_identity(
    _app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    key_name: String,
) -> Result<()> {
    let ssh_dir = state.storage.ssh_dir.clone();
    crate::ssh::agent_remove_identity(&ssh_dir, &key_name).await
}
