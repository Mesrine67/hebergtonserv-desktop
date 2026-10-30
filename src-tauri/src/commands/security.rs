use crate::AppState;
use crate::errors::Result;
use crate::storage::Storage;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityState {
    pub keyring_available: bool,
    pub https_only: bool,
}

#[tauri::command]
pub async fn get_security_state(_app: tauri::AppHandle) -> Result<SecurityState> {
    let probe = Entry::new("hebergtonserv", "security-state-probe");
    let keyring_available = probe
        .and_then(|entry| entry.get_password())
        .map(|value| !value.is_empty())
        .unwrap_or(false);
    Ok(SecurityState {
        keyring_available,
        https_only: true,
    })
}
