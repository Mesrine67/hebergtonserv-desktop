use crate::errors::Result;
use crate::providers::http::ApiClient;
use crate::providers::models::{
    CreatedPanelApiKey, PanelAccount, PanelApiKey, PanelServerResources, PanelSshKey,
};
use crate::providers::{Capability, PanelProvider, ProviderKind};
use async_trait::async_trait;

pub struct WispProvider {
    pub base_url: String,
    pub token: String,
    pub allow_local: bool,
    pub version: String,
}

impl WispProvider {
    pub fn new(base_url: &str, token: &str, allow_local: bool, version: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
            allow_local,
            version: version.to_string(),
        }
    }

    fn accept(&self) -> &'static str {
        "application/vnd.wisp.v1+json"
    }

    fn help_url(&self, page: &str) -> String {
        format!("{}/{}", self.base_url.trim_end_matches('/'), page)
    }
}

#[async_trait]
impl PanelProvider for WispProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Wisp
    }

    async fn account(&self) -> Result<PanelAccount> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        client.get_account().await
    }

    async fn list_servers(&self) -> Result<Vec<crate::providers::models::PanelServer>> {
        ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?
            .list_servers(self.accept(), "wisp")
            .await
    }

    async fn server_resources(&self, identifier: &str) -> Result<PanelServerResources> {
        ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?
            .get_server_resources(self.accept(), identifier)
            .await
    }

    async fn list_api_keys(&self) -> Result<Capability<Vec<PanelApiKey>>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        let result = client
            .send_json::<crate::providers::http::PanelListResponse<PanelApiKey>>(
                reqwest::Method::GET,
                "/api/client/security/credentials",
                None,
            )
            .await;
        match result {
            Ok(response) => Ok(Capability::supported(response.data)),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "L'endpoint de gestion des clés API n'est pas exposé par cette instance Wisp.",
                        Some(self.help_url("account/api-keys")),
                        false,
                    ));
                }
                Err(error)
            }
        }
    }

    async fn create_api_key(
        &self,
        _description: &str,
        _allowed_ips: &[String],
    ) -> Result<Capability<CreatedPanelApiKey>> {
        Ok(Capability::unsupported(
            "La création de clés API n'est pas exposée par l'API publique documentée de Wisp.",
            Some(self.help_url("account/api-keys")),
            false,
        ))
    }

    async fn revoke_api_key(&self, _identifier: &str) -> Result<Capability<()>> {
        Ok(Capability::unsupported(
            "La révocation de clés API n'est pas exposée par l'API publique documentée de Wisp.",
            Some(self.help_url("account/api-keys")),
            false,
        ))
    }

    async fn list_ssh_keys(&self) -> Result<Capability<Vec<PanelSshKey>>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        let result = client
            .send_json::<crate::providers::http::PanelListResponse<PanelSshKey>>(
                reqwest::Method::GET,
                "/api/client/account/ssh-keys",
                None,
            )
            .await;
        match result {
            Ok(response) => Ok(Capability::supported(response.data)),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "L'endpoint de gestion des clés SSH n'est pas exposé par cette instance Wisp.",
                        Some(self.help_url("account/ssh-keys")),
                        false,
                    ));
                }
                Err(error)
            }
        }
    }

    async fn create_ssh_key(
        &self,
        _name: &str,
        _public_key: &str,
    ) -> Result<Capability<PanelSshKey>> {
        Ok(Capability::unsupported(
            "La création de clés SSH via l'API n'est pas disponible sur cette instance.",
            Some(self.help_url("account/ssh-keys")),
            false,
        ))
    }

    async fn delete_ssh_key(&self, _fingerprint: &str) -> Result<Capability<()>> {
        Ok(Capability::unsupported(
            "La révocation de clés SSH via l'API n'est pas disponible sur cette instance.",
            Some(self.help_url("account/ssh-keys")),
            false,
        ))
    }
}
