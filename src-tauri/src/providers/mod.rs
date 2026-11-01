pub mod http;
pub mod models;
pub mod pterodactyl;
pub mod wisp;

use crate::errors::Result;
use crate::providers::models::{
    CreatedPanelApiKey, PanelAccount, PanelApiKey, PanelServer, PanelServerResources, PanelSshKey,
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capability<T> {
    pub supported: bool,
    pub value: Option<T>,
    pub message: Option<String>,
    pub help_url: Option<String>,
    pub verified: bool,
}

impl<T> Capability<T> {
    pub fn supported(value: T) -> Self {
        Self {
            supported: true,
            value: Some(value),
            message: None,
            help_url: None,
            verified: true,
        }
    }

    pub fn unsupported(
        message: impl Into<String>,
        help_url: Option<String>,
        verified: bool,
    ) -> Self {
        Self {
            supported: false,
            value: None,
            message: Some(message.into()),
            help_url,
            verified,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    Wisp,
    Pterodactyl,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ProviderKind::Wisp => "wisp",
            ProviderKind::Pterodactyl => "pterodactyl",
        }
    }
}

#[async_trait]
pub trait PanelProvider: Send + Sync + 'static {
    fn kind(&self) -> ProviderKind;

    async fn account(&self) -> Result<PanelAccount>;

    async fn list_servers(&self) -> Result<Vec<PanelServer>>;

    async fn server_resources(&self, identifier: &str) -> Result<PanelServerResources>;

    async fn list_api_keys(&self) -> Result<Capability<Vec<PanelApiKey>>>;

    async fn create_api_key(
        &self,
        _description: &str,
        _allowed_ips: &[String],
    ) -> Result<Capability<CreatedPanelApiKey>>;

    async fn revoke_api_key(&self, _identifier: &str) -> Result<Capability<()>>;

    async fn list_ssh_keys(&self) -> Result<Capability<Vec<PanelSshKey>>>;

    async fn create_ssh_key(
        &self,
        _name: &str,
        _public_key: &str,
    ) -> Result<Capability<PanelSshKey>>;

    async fn delete_ssh_key(&self, _fingerprint: &str) -> Result<Capability<()>>;
}
