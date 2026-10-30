use crate::errors::Result;
use crate::providers::http::ApiClient;
use crate::providers::models::{CreatedPanelApiKey, PanelAccount, PanelApiKey, PanelSshKey};
use crate::providers::{Capability, PanelProvider, ProviderKind};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct PterodactylProvider {
    pub base_url: String,
    pub token: String,
    pub allow_local: bool,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyListResponse {
    #[serde(default)]
    pub data: Vec<PanelApiKey>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCreateResponse {
    #[serde(default)]
    pub object: Option<String>,
    #[serde(default)]
    pub attributes: PanelApiKey,
    #[serde(default)]
    pub meta: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyListResponse {
    #[serde(default)]
    pub data: Vec<PanelSshKey>,
}

impl PterodactylProvider {
    pub fn new(base_url: &str, token: &str, allow_local: bool, version: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
            allow_local,
            version: version.to_string(),
        }
    }

    fn accept(&self) -> &'static str {
        "application/vnd.pterodactyl.v1+json"
    }

    fn help_url(&self, page: &str) -> String {
        format!("{}/{}", self.base_url.trim_end_matches('/'), page)
    }
}

#[async_trait]
impl PanelProvider for PterodactylProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Pterodactyl
    }

    async fn account(&self) -> Result<PanelAccount> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        client.get_account_pterodactyl().await.map(|user| {
            let attributes = user
                .map(|user| user.attributes)
                .unwrap_or_default();
            let display_name = if attributes.first_name.is_some() || attributes.last_name.is_some()
            {
                format!(
                    "{}{}",
                    attributes.first_name.as_deref().unwrap_or(""),
                    attributes.last_name.as_deref().unwrap_or("")
                )
            } else {
                attributes.username.clone().unwrap_or_default()
            };
            PanelAccount {
                id: attributes.id.unwrap_or(0),
                username: attributes.username.clone().unwrap_or_default(),
                email: attributes.email.clone().unwrap_or_default(),
                display_name,
                admin: attributes.root_admin.unwrap_or(false) || attributes.admin.unwrap_or(false),
            }
        })
    }

    async fn list_api_keys(&self) -> Result<Capability<Vec<PanelApiKey>>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        let result = client
            .send_json::<ApiKeyListResponse>(
                reqwest::Method::GET,
                "/api/client/account/api-keys",
                None,
            )
            .await;
        match result {
            Ok(response) => Ok(Capability::supported(response.data)),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "L'endpoint de gestion des clés API n'est pas exposé par cette instance.",
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
        description: &str,
        allowed_ips: &[String],
    ) -> Result<Capability<CreatedPanelApiKey>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        let mut body = serde_json::json!({ "description": description });
        if !allowed_ips.is_empty() {
            body["allowed_ips"] = serde_json::json!(allowed_ips);
        }
        let result = client
            .send_json::<ApiKeyCreateResponse>(
                reqwest::Method::POST,
                "/api/client/account/api-keys",
                Some(&body),
            )
            .await;
        match result {
            Ok(response) => Ok(Capability::supported(CreatedPanelApiKey {
                key: response.attributes,
                secret_token: response.meta.and_then(|meta| {
                    meta.get("secret_token")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string())
                }),
            })),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "La création de clés API n'est pas exposée par cette instance.",
                        Some(self.help_url("account/api-keys")),
                        false,
                    ));
                }
                Err(error)
            }
        }
    }

    async fn revoke_api_key(&self, identifier: &str) -> Result<Capability<()>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        let result = client
            .send_json::<serde_json::Value>(
                reqwest::Method::DELETE,
                &format!("/api/client/account/api-keys/{identifier}"),
                None,
            )
            .await;
        match result {
            Ok(_) => Ok(Capability::supported(())),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "La révocation de clés API n'est pas exposée par cette instance.",
                        Some(self.help_url("account/api-keys")),
                        false,
                    ));
                }
                Err(error)
            }
        }
    }

    async fn list_ssh_keys(&self) -> Result<Capability<Vec<PanelSshKey>>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        let result = client
            .send_json::<SshKeyListResponse>(
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
                        "La gestion des clés SSH n'est pas exposée par cette instance.",
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
        name: &str,
        public_key: &str,
    ) -> Result<Capability<PanelSshKey>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        let body = serde_json::json!({ "name": name, "public_key": public_key });
        let result = client
            .send_json::<PanelSshKey>(
                reqwest::Method::POST,
                "/api/client/account/ssh-keys",
                Some(&body),
            )
            .await;
        match result {
            Ok(response) => Ok(Capability::supported(response)),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "La création de clés SSH n'est pas exposée par cette instance.",
                        Some(self.help_url("account/ssh-keys")),
                        false,
                    ));
                }
                Err(error)
            }
        }
    }

    async fn delete_ssh_key(&self, fingerprint: &str) -> Result<Capability<()>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept())?;
        let body = serde_json::json!({ "fingerprint": fingerprint });
        let result = client
            .send_json::<serde_json::Value>(
                reqwest::Method::POST,
                "/api/client/account/ssh-keys/remove",
                Some(&body),
            )
            .await;
        match result {
            Ok(_) => Ok(Capability::supported(())),
            Err(error) => {
                if error.code() == "api_not_found" {
                    return Ok(Capability::unsupported(
                        "La révocation de clés SSH n'est pas exposée par cette instance.",
                        Some(self.help_url("account/ssh-keys")),
                        false,
                    ));
                }
                Err(error)
            }
        }
    }
}
