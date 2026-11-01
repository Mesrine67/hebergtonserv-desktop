use serde::{Deserialize, Serialize};

fn deserialize_optional_user_id<'de, D>(
    deserializer: D,
) -> std::result::Result<Option<i64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(number)) => number.as_i64(),
        Some(serde_json::Value::String(value)) => value.parse().ok(),
        _ => None,
    })
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct PanelUserAttributes {
    #[serde(default, deserialize_with = "deserialize_optional_user_id")]
    pub id: Option<i64>,
    pub username: Option<String>,
    pub email: Option<String>,
    #[serde(alias = "name_first")]
    pub first_name: Option<String>,
    #[serde(alias = "name_last")]
    pub last_name: Option<String>,
    pub admin: Option<bool>,
    pub language: Option<String>,
    pub root_admin: Option<bool>,
    pub use_totp: Option<bool>,
    pub support_op: Option<bool>,
    pub sso_enabled: Option<bool>,
    #[serde(default)]
    pub preferences: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PanelUser {
    pub attributes: PanelUserAttributes,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelAccount {
    pub id: i64,
    pub username: String,
    pub email: String,
    pub display_name: String,
    pub admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelServer {
    pub id: String,
    pub identifier: String,
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub node: Option<String>,
    pub egg: Option<String>,
    pub limits: PanelServerLimits,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PanelServerLimits {
    pub memory: Option<u64>,
    pub swap: Option<u64>,
    pub disk: Option<u64>,
    pub io: Option<u64>,
    pub cpu: Option<u64>,
    pub threads: Option<String>,
    pub databases: Option<u64>,
    pub allocations: Option<u64>,
    pub backups: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PanelApiKey {
    pub identifier: String,
    pub description: String,
    #[serde(default)]
    pub allowed_ips: Option<serde_json::Value>,
    pub created_at: Option<String>,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatedPanelApiKey {
    pub key: PanelApiKey,
    #[serde(default)]
    pub secret_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default, Deserialize)]
pub struct PanelSshKey {
    pub name: String,
    pub fingerprint: String,
    pub public_key: String,
    #[serde(default)]
    pub created_at: Option<String>,
}

impl PanelSshKey {
    pub fn new(name: String, public_key: String) -> Self {
        Self {
            name,
            fingerprint: String::new(),
            public_key,
            created_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelSshKeyList {
    #[serde(default)]
    pub data: Vec<PanelSshKey>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelCapabilities {
    pub provider: String,
    pub account_supported: bool,
    pub api_keys_supported: bool,
    pub ssh_keys_supported: bool,
    pub account_verified: bool,
    pub api_keys_verified: bool,
    pub ssh_keys_verified: bool,
}
