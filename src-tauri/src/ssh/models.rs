use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SshKeySummary {
    pub id: String,
    pub name: String,
    pub public_key_file: Option<String>,
    pub private_key_file: Option<String>,
    pub key_type: Option<String>,
    pub fingerprint: Option<String>,
    pub comment: Option<String>,
    pub has_private: bool,
    pub encrypted: bool,
    pub permissions_warning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicKeyContent {
    pub public_key: String,
    pub fingerprint: String,
    pub key_type: String,
    pub comment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIdentity {
    pub id: String,
    pub comment: Option<String>,
    pub fingerprint: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectionResult {
    pub state: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfigEntry {
    pub host: String,
    pub port: Option<u16>,
    pub user: Option<String>,
    pub identity_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfigSnapshot {
    pub path: String,
    pub entries: Vec<SshConfigEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashEntry {
    pub trash_id: String,
    pub original_name: String,
    pub private_file: Option<String>,
    pub public_file: Option<String>,
}
