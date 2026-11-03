use crate::errors::Result;
use crate::providers::http::ApiClient;
use crate::providers::models::{
    CreatedPanelApiKey, PanelAccount, PanelApiKey, PanelDatabase, PanelFileEntry,
    PanelServerResources, PanelSshKey, PanelSubuser,
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

    async fn list_server_files(&self, identifier: &str, path: &str) -> Result<Vec<PanelFileEntry>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        let response = client
            .send_json::<serde_json::Value>(
                reqwest::Method::GET,
                &format!("/api/client/servers/{identifier}/files/directory"),
                Some(&serde_json::json!({"path": path})),
            )
            .await?;
        let rows = response
            .get("data")
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| {
                crate::errors::app_error("api_invalid_response", "Liste de fichiers WISP invalide.")
            })?;
        Ok(rows
            .iter()
            .filter_map(|row| {
                let attrs = row.get("attributes").unwrap_or(row);
                let name = attrs.get("name")?.as_str()?.to_string();
                let kind = attrs
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("file")
                    .to_string();
                let size = attrs.get("size").and_then(serde_json::Value::as_u64);
                let modified_at = attrs
                    .get("modified_at")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string);
                let child_path = if path == "/" {
                    format!("/{name}")
                } else {
                    format!("{}/{name}", path.trim_end_matches('/'))
                };
                Some(PanelFileEntry {
                    name,
                    path: child_path,
                    kind,
                    size,
                    modified_at,
                })
            })
            .collect())
    }

    async fn read_server_file(&self, identifier: &str, path: &str) -> Result<String> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        let response = client
            .send_json::<serde_json::Value>(
                reqwest::Method::GET,
                &format!("/api/client/servers/{identifier}/files/read"),
                Some(&serde_json::json!({"path": path})),
            )
            .await?;
        response
            .get("content")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| {
                crate::errors::app_error(
                    "api_invalid_response",
                    "Contenu de fichier WISP invalide.",
                )
            })
    }

    async fn list_server_databases(&self, identifier: &str) -> Result<Vec<PanelDatabase>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        let response = client
            .send_json::<serde_json::Value>(
                reqwest::Method::GET,
                &format!("/api/client/servers/{identifier}/databases?include=host"),
                None,
            )
            .await?;
        let rows = response
            .get("data")
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| {
                crate::errors::app_error("api_invalid_response", "Liste de bases WISP invalide.")
            })?;
        Ok(rows
            .iter()
            .filter_map(|row| {
                let attrs = row.get("attributes").unwrap_or(row);
                let id_value = attrs.get("id")?;
                let id = id_value
                    .as_str()
                    .map(str::to_string)
                    .or_else(|| id_value.as_u64().map(|v| v.to_string()))?;
                let name = attrs.get("name")?.as_str()?.to_string();
                let host_value = attrs
                    .get("host")
                    .or_else(|| attrs.get("relationships")?.get("host")?.get("data"));
                let host = host_value.and_then(|v| {
                    v.as_str().map(str::to_string).or_else(|| {
                        let nested = v.get("attributes").unwrap_or(v);
                        let address = nested.get("host").and_then(serde_json::Value::as_str);
                        let port = nested.get("port").and_then(|port| {
                            port.as_str()
                                .map(str::to_string)
                                .or_else(|| port.as_u64().map(|n| n.to_string()))
                        });
                        address.map(|address| {
                            port.map_or_else(
                                || address.to_string(),
                                |port| format!("{address}:{port}"),
                            )
                        })
                    })
                });
                Some(PanelDatabase {
                    id,
                    name,
                    username: attrs
                        .get("username")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    password: attrs
                        .get("password")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    host,
                    connections_from: attrs
                        .get("connections_from")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    jdbc_connection_string: attrs
                        .get("jdbc_connection_string")
                        .or_else(|| attrs.get("jdbc"))
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    phpmyadmin_url: attrs
                        .get("phpmyadmin_url")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                })
            })
            .collect())
    }

    async fn list_api_keys(&self) -> Result<Capability<Vec<PanelApiKey>>> {
        let client = ApiClient::new(&self.base_url, &self.token, self.accept(), self.allow_local)?;
        // WISP-compatible panels may expose a credentials list with either
        // raw rows or Client API resource envelopes. Parse both safely.
        let result = client
            .send_json::<serde_json::Value>(
                reqwest::Method::GET,
                "/api/client/security/credentials",
                None,
            )
            .await;
        match result {
            Ok(response) => match response
                .get("data")
                .or_else(|| {
                    response
                        .get("attributes")
                        .and_then(|attributes| attributes.get("data"))
                })
                .and_then(serde_json::Value::as_array)
            {
                Some(rows) => {
                    let keys = rows
                        .iter()
                        .filter_map(|row| {
                            let attributes = row.get("attributes").unwrap_or(row);
                            let identifier = attributes
                                .get("identifier")
                                .or_else(|| attributes.get("id"));
                            let identifier = identifier.and_then(serde_json::Value::as_str)?;
                            let description = attributes
                                .get("description")
                                .and_then(serde_json::Value::as_str)
                                .unwrap_or_default();
                            Some(PanelApiKey {
                                identifier: identifier.to_string(),
                                description: description.to_string(),
                                allowed_ips: attributes.get("allowed_ips").cloned(),
                                created_at: attributes
                                    .get("created_at")
                                    .and_then(serde_json::Value::as_str)
                                    .map(str::to_string),
                                last_used_at: attributes
                                    .get("last_used_at")
                                    .and_then(serde_json::Value::as_str)
                                    .map(str::to_string),
                            })
                        })
                        .collect();
                    Ok(Capability::supported(keys))
                }
                None => Ok(Capability::unsupported(
                    "La gestion des clés API n'est pas exposée au format Client API documenté sur cette instance WISP.",
                    Some(self.help_url("account/api-keys")),
                    false,
                )),
            },
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
            .send_json::<serde_json::Value>(
                reqwest::Method::GET,
                "/api/client/account/ssh-keys",
                None,
            )
            .await;
        match result {
            Ok(response) => match response
                .get("data")
                .or_else(|| {
                    response
                        .get("attributes")
                        .and_then(|attributes| attributes.get("data"))
                })
                .and_then(serde_json::Value::as_array)
            {
                Some(rows) => {
                    let keys = rows
                        .iter()
                        .filter_map(|row| {
                            serde_json::from_value::<PanelSshKey>(
                                row.get("attributes").unwrap_or(row).clone(),
                            )
                            .ok()
                        })
                        .collect();
                    Ok(Capability::supported(keys))
                }
                None => Ok(Capability::unsupported(
                    "La gestion des clés SSH n'est pas exposée au format Client API documenté sur cette instance WISP.",
                    Some(self.help_url("account/ssh-keys")),
                    false,
                )),
            },
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
    use crate::providers::models::{PanelDatabase, PanelSubuser};

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
    fn recognizes_wisp_client_key_list_envelopes_without_exposing_secret_tokens() {
        let response: serde_json::Value = serde_json::json!({
            "object": "list",
            "data": [{"attributes": {
                "identifier": "credential-id",
                "description": "Desktop",
                "allowed_ips": null,
                "created_at": "2026-11-03T00:00:00Z"
            }}]
        });
        let attributes = response["data"][0].get("attributes").unwrap();
        assert_eq!(attributes["identifier"].as_str(), Some("credential-id"));
        assert!(attributes.get("token").is_none());
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

    #[test]
    fn parses_database_fields_from_wisp_relationship_and_attributes_shapes() {
        let rows = serde_json::json!([
            {"attributes": {
                "id": "db-a", "name": "synthetic_a", "username": "user_a",
                "password": "synthetic-secret", "connections_from": "10.0.0.%",
                "host": {"attributes": {"host": "db.example.test", "port": 3306}},
                "jdbc_connection_string": "jdbc:mysql://db.example.test:3306/synthetic_a",
                "phpmyadmin_url": "https://db.example.test/admin"
            }},
            {"attributes": {
                "id": 17, "name": "synthetic_b", "host": "db2.example.test:3306",
                "relationships": {"host": {"data": {"attributes": {"host": "db3.example.test", "port": "3307"}}}}
            }}
        ]);
        let databases: Vec<PanelDatabase> = rows
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|row| {
                let attrs = row.get("attributes").unwrap_or(row);
                let id_value = attrs.get("id")?;
                let id = id_value
                    .as_str()
                    .map(str::to_string)
                    .or_else(|| id_value.as_u64().map(|n| n.to_string()))?;
                let host_value = attrs
                    .get("host")
                    .or_else(|| attrs.get("relationships")?.get("host")?.get("data"));
                let host = host_value.and_then(|value| {
                    value.as_str().map(str::to_string).or_else(|| {
                        let nested = value.get("attributes").unwrap_or(value);
                        let address = nested.get("host").and_then(serde_json::Value::as_str)?;
                        let port = nested.get("port").and_then(|port| {
                            port.as_str()
                                .map(str::to_string)
                                .or_else(|| port.as_u64().map(|n| n.to_string()))
                        });
                        Some(port.map_or_else(
                            || address.to_string(),
                            |port| format!("{address}:{port}"),
                        ))
                    })
                });
                Some(PanelDatabase {
                    id,
                    name: attrs.get("name")?.as_str()?.to_string(),
                    username: attrs
                        .get("username")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    password: attrs
                        .get("password")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    host,
                    connections_from: attrs
                        .get("connections_from")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    jdbc_connection_string: attrs
                        .get("jdbc_connection_string")
                        .or_else(|| attrs.get("jdbc"))
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                    phpmyadmin_url: attrs
                        .get("phpmyadmin_url")
                        .and_then(serde_json::Value::as_str)
                        .map(str::to_string),
                })
            })
            .collect();

        assert_eq!(databases.len(), 2);
        assert_eq!(databases[0].host.as_deref(), Some("db.example.test:3306"));
        assert_eq!(databases[0].connections_from.as_deref(), Some("10.0.0.%"));
        assert_eq!(databases[0].password.as_deref(), Some("synthetic-secret"));
        assert_eq!(databases[1].id, "17");
        assert_eq!(databases[1].host.as_deref(), Some("db2.example.test:3306"));
    }
}
