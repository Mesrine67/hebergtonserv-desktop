#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SettingsData {
    pub close_to_tray: bool,
    pub start_with_windows: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SettingsDocument {
    pub version: u32,
    pub data: SettingsData,
}

impl Default for SettingsDocument {
    fn default() -> Self {
        Self {
            version: 1,
            data: SettingsData {
                close_to_tray: false,
                start_with_windows: false,
            },
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PanelConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub pterodactyl_version: String,
    pub allow_local: bool,
    pub status: Option<String>,
    pub account_label: Option<String>,
    pub last_checked_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PanelsData {
    pub panels: Vec<PanelConfig>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PanelsDocument {
    pub version: u32,
    pub data: PanelsData,
}

impl Default for PanelsDocument {
    fn default() -> Self {
        Self {
            version: 1,
            data: PanelsData {
                panels: vec![PanelConfig {
                    id: "panel-hebergtonserv".to_string(),
                    name: "HébergTonServ".to_string(),
                    provider: "wisp".to_string(),
                    base_url: "https://manage.hebergtonserv.com/".to_string(),
                    pterodactyl_version: "auto".to_string(),
                    allow_local: false,
                    status: None,
                    account_label: None,
                    last_checked_at: None,
                }],
            },
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SshProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub key_name: Option<String>,
    pub group: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub last_connected_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProfilesData {
    pub profiles: Vec<SshProfile>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProfilesDocument {
    pub version: u32,
    pub data: ProfilesData,
}

impl Default for ProfilesDocument {
    fn default() -> Self {
        Self {
            version: 1,
            data: ProfilesData {
                profiles: Vec::new(),
            },
        }
    }
}
