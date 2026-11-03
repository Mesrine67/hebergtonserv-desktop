use crate::errors::Result;
use crate::providers::http::ApiClient;
use crate::providers::models::{
    CreatedPanelApiKey, PanelAccount, PanelApiKey, PanelServerResources, PanelSshKey, PanelSubuser,
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
        // WISP Panel 2.x is a product version, not proof of an API v2 contract.
        // Only send the undocumented MIME variant after explicit user opt-in.
        if self.version == "wisp-v2-experimental" {
            "application/vnd.wisp.v2+json"
        } else {
            "application/vnd.wisp.v1+json"
        }
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

    async fn list_server_subusers(
        &self,
        identifier: &str,
    ) -> Result<Capability<Vec<PanelSubuser>>> {
        if identifier.is_empty()
            || identifier.len() > 128
            || !identifier.chars().all(|character| {
                character.is_ascii_alphanumeric() || character == '-' || character == '_'
            })
        {
            return Err(crate::errors::app_error(
                "api_config",
                "Identifiant serveur invalide.",
            ));
        }

        const PAGE_SIZE: u64 = 25;
        const MAX_PAGES: u64 = 100;
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        let mut subusers = Vec::new();
        for page in 1..=MAX_PAGES {
            let path = format!(
                "/api/client/servers/{identifier}/subusers?per_page={PAGE_SIZE}&page={page}"
            );
            let response = client
                .send_json::<serde_json::Value>(reqwest::Method::GET, &path, None)
                .await?;
            let rows = response
                .get("data")
                .and_then(serde_json::Value::as_array)
                .ok_or_else(|| {
                    crate::errors::app_error(
                        "api_invalid_response",
                        "La liste des sous-utilisateurs WISP est invalide.",
                    )
                })?;
            if rows.is_empty() {
                break;
            }
            for row in rows {
                let user = row.get("attributes").unwrap_or(row);
                subusers.push(
                    serde_json::from_value::<PanelSubuser>(user.clone()).map_err(|_| {
                        crate::errors::app_error(
                            "api_invalid_response",
                            "Un sous-utilisateur WISP a un format invalide.",
                        )
                    })?,
                );
            }

            let total_pages = response
                .get("meta")
                .and_then(|meta| meta.get("pagination"))
                .and_then(|pagination| pagination.get("total_pages"))
                .and_then(serde_json::Value::as_u64);
            if total_pages.is_some_and(|total| page >= total)
                || (total_pages.is_none() && (rows.len() as u64) < PAGE_SIZE)
            {
                break;
            }
        }

        Ok(Capability::supported(subusers))
    }
}

#[cfg(test)]
mod compatibility_tests {
    use super::WispProvider;
    use crate::providers::models::PanelSubuser;

    #[test]
    fn parses_wisp_browser_client_subuser_response() {
        let response: serde_json::Value = serde_json::json!({
            "object": "list",
            "data": [{
                "id": "user-uuid",
                "permissions": ["console.read", "power.start"],
                "created_at": "2026-11-03T00:00:00Z",
                "updated_at": "2026-11-03T00:00:00Z"
            }],
            "meta": {"pagination": {"total_pages": 1, "current_page": 1, "count": 1}}
        });
        let user: PanelSubuser = serde_json::from_value(response["data"][0].clone()).unwrap();
        assert_eq!(user.uuid, "user-uuid");
        assert_eq!(user.permissions, ["console.read", "power.start"]);
    }

    #[test]
    fn wisp_v1_is_default_and_v2_requires_explicit_opt_in() {
        for version in ["auto", "1", "2", "v2", "unknown"] {
            assert_eq!(
                WispProvider::new("https://panel.example.test", "token", false, version).accept(),
                "application/vnd.wisp.v1+json"
            );
        }
        assert_eq!(
            WispProvider::new(
                "https://panel.example.test",
                "token",
                false,
                "wisp-v2-experimental"
            )
            .accept(),
            "application/vnd.wisp.v2+json"
        );
    }
}
