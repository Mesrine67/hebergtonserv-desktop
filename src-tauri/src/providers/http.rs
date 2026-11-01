use crate::errors::{Result, app_error, http_error};
use crate::providers::models::{
    PanelAccount, PanelServer, PanelServerLimits, PanelServerResources, PanelUser,
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use std::time::Duration;

const MAX_RESPONSE_BYTES: usize = 1_048_576;

fn append_bounded_response_chunk(out: &mut Vec<u8>, chunk: &[u8]) -> Result<()> {
    if chunk.len() > MAX_RESPONSE_BYTES.saturating_sub(out.len()) {
        return Err(app_error(
            "api_response_too_large",
            "Réponse du panneau trop volumineuse.",
        ));
    }
    out.extend_from_slice(chunk);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelListResponse<T> {
    #[serde(default)]
    pub data: Vec<T>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PaginationMeta {
    #[serde(default)]
    pub pagination: Pagination,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Pagination {
    #[serde(default)]
    pub total_pages: u64,
    #[serde(default)]
    pub current_page: u64,
    #[serde(default)]
    pub count: u64,
    #[serde(default)]
    pub links: PaginationLinks,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PaginationLinks {
    #[serde(default)]
    pub next: Option<String>,
}

fn server_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value.get(key).and_then(|item| {
            item.as_str()
                .map(str::to_owned)
                .or_else(|| item.as_u64().map(|n| n.to_string()))
        })
    })
}

fn value_u64(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        value.get(key).and_then(|item| {
            item.as_u64()
                .or_else(|| item.as_str().and_then(|string| string.parse().ok()))
        })
    })
}

fn value_f64(value: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|key| {
        value.get(key).and_then(|item| {
            item.as_f64()
                .or_else(|| item.as_str().and_then(|string| string.parse().ok()))
        })
    })
}

fn server_connect_address(attrs: &Value) -> Option<String> {
    let allocations = attrs
        .get("relationships")?
        .get("allocations")?
        .get("data")?
        .as_array()?;
    let allocation = allocations
        .iter()
        .find(|allocation| {
            allocation
                .get("attributes")
                .and_then(|attributes| attributes.get("is_default"))
                .and_then(Value::as_bool)
                == Some(true)
        })
        .or_else(|| allocations.first())?;
    let allocation = allocation.get("attributes").unwrap_or(allocation);
    let host = server_string(allocation, &["ip_alias", "ip"])?;
    let port = server_string(allocation, &["port"])?;
    Some(format!("{host}:{port}"))
}

fn parse_server_resources(value: Value) -> PanelServerResources {
    let attrs = value.get("attributes").unwrap_or(&value);
    let proc = attrs.get("proc").unwrap_or(&Value::Null);
    let memory = proc.get("memory").unwrap_or(&Value::Null);
    let cpu = proc.get("cpu").unwrap_or(&Value::Null);
    let disk = proc.get("disk").unwrap_or(&Value::Null);
    let resources = attrs.get("resources").unwrap_or(&Value::Null);
    let query = attrs.get("query").unwrap_or(&Value::Null);
    let state = server_string(attrs, &["current_state", "state"]).or_else(|| {
        value_u64(attrs, &["status"])
            .map(|status| if status == 1 { "running" } else { "offline" }.to_string())
    });
    let players = query
        .get("players")
        .and_then(Value::as_array)
        .map(|players| players.len() as u64)
        .or_else(|| value_u64(query, &["numplayers", "players"]));
    let max_players = value_u64(query, &["maxplayers", "max_players"]);
    let connect_address = server_string(query, &["connect"]).or_else(|| {
        let host = server_string(query, &["hostip", "ip"])?;
        let port = server_string(query, &["hostport", "port"])?;
        Some(format!("{host}:{port}"))
    });

    PanelServerResources {
        state,
        suspended: attrs
            .get("is_suspended")
            .or_else(|| attrs.get("suspended"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        memory_used_bytes: value_u64(resources, &["memory_bytes"])
            .or_else(|| value_u64(memory, &["total", "used"])),
        memory_limit_bytes: value_u64(memory, &["limit"]),
        cpu_percent: value_f64(resources, &["cpu_absolute"])
            .or_else(|| value_f64(cpu, &["total", "used"])),
        cpu_limit_percent: value_f64(cpu, &["limit"]),
        disk_used_bytes: value_u64(resources, &["disk_bytes"])
            .or_else(|| value_u64(disk, &["used", "total"])),
        disk_limit_bytes: value_u64(resources, &["disk_limit_bytes"]).or_else(|| {
            value_u64(disk, &["limit"]).map(|limit_mib| limit_mib.saturating_mul(1024 * 1024))
        }),
        network_rx_bytes: value_u64(resources, &["network_rx_bytes"]),
        network_tx_bytes: value_u64(resources, &["network_tx_bytes"]),
        uptime_ms: value_u64(resources, &["uptime"]),
        players,
        max_players,
        connect_address,
    }
}

fn parse_server(value: Value) -> Result<PanelServer> {
    let attrs = value.get("attributes").unwrap_or(&value);
    let id = server_string(attrs, &["uuid", "id"]).ok_or_else(|| {
        app_error(
            "api_invalid_response",
            "Un serveur ne contient pas d'identifiant.",
        )
    })?;
    let identifier = server_string(attrs, &["identifier", "uuid_short", "uuidShort"])
        .unwrap_or_else(|| id.clone());
    let limits = attrs.get("limits").cloned().unwrap_or(Value::Null);
    let mut limits: PanelServerLimits = serde_json::from_value(limits).unwrap_or_default();
    if limits.databases.is_none() || limits.allocations.is_none() || limits.backups.is_none() {
        if let Some(feature_limits) = attrs.get("feature_limits") {
            let feature_limits: PanelServerLimits =
                serde_json::from_value(feature_limits.clone()).unwrap_or_default();
            limits.databases = limits.databases.or(feature_limits.databases);
            limits.allocations = limits.allocations.or(feature_limits.allocations);
            limits.backups = limits.backups.or(feature_limits.backups);
        }
    }
    let included = attrs.get("relationships").unwrap_or(&Value::Null);
    let node = server_string(attrs, &["node"]).or_else(|| {
        included
            .get("node")
            .and_then(|v| v.get("attributes"))
            .and_then(|v| server_string(v, &["name"]))
    });
    let egg = server_string(attrs, &["egg", "image"]).or_else(|| {
        included
            .get("egg")
            .and_then(|v| v.get("attributes"))
            .and_then(|v| server_string(v, &["name"]))
    });
    let name = server_string(attrs, &["name"]).unwrap_or_else(|| identifier.clone());
    Ok(PanelServer {
        id,
        identifier,
        name,
        description: attrs
            .get("description")
            .and_then(Value::as_str)
            .map(str::to_owned),
        status: attrs
            .get("status")
            .and_then(Value::as_str)
            .map(str::to_owned),
        node,
        connect_address: server_connect_address(attrs),
        suspended: attrs
            .get("is_suspended")
            .or_else(|| attrs.get("suspended"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        installing: attrs
            .get("is_installing")
            .or_else(|| attrs.get("installing"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        egg,
        limits,
    })
}

pub struct ApiClient {
    pub base_url: String,
    pub token: String,
    pub accept: String,
    pub allow_local: bool,
}

// Keep authorization failures distinct from missing provider endpoints. A 401
// must never be interpreted as permission to retry with another API route.
fn http_error_code(status: reqwest::StatusCode) -> &'static str {
    match status.as_u16() {
        401 => "api_auth_failed",
        403 => "api_forbidden",
        404 => "api_not_found",
        400 | 422 => "api_validation_error",
        429 => "api_rate_limited",
        _ => "api_error",
    }
}

fn fallback_to_pterodactyl(error_code: &str) -> bool {
    matches!(
        error_code,
        "api_not_found" | "api_invalid_response" | "api_error"
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountApi {
    Wisp,
    Pterodactyl,
}

fn parse_account_user(value: Value) -> Result<Option<PanelUser>> {
    let candidate = value
        .get("user")
        .or_else(|| value.get("data").filter(|data| data.is_object()))
        .unwrap_or(&value);
    if candidate.is_null() {
        return Ok(None);
    }

    let user = if candidate.get("attributes").is_some() {
        serde_json::from_value::<PanelUser>(candidate.clone())
    } else {
        serde_json::from_value::<PanelUser>(serde_json::json!({ "attributes": candidate }))
    }
    .map_err(|_| {
        app_error(
            "api_invalid_response",
            "Le format du compte renvoyé par le panel n'est pas reconnu.",
        )
    })?;

    let attributes = &user.attributes;
    if attributes.id.is_none()
        && attributes
            .username
            .as_deref()
            .unwrap_or_default()
            .is_empty()
        && attributes.email.as_deref().unwrap_or_default().is_empty()
    {
        return Ok(None);
    }
    Ok(Some(user))
}

fn account_from_user(user: PanelUser) -> Result<PanelAccount> {
    let attributes = user.attributes;
    let username = attributes.username.unwrap_or_default();
    let email = attributes.email.unwrap_or_default();
    let display_name = if attributes.first_name.is_some() || attributes.last_name.is_some() {
        format!(
            "{} {}",
            attributes.first_name.as_deref().unwrap_or(""),
            attributes.last_name.as_deref().unwrap_or("")
        )
        .trim()
        .to_string()
    } else if !username.is_empty() {
        username.clone()
    } else {
        email.clone()
    };
    if display_name.is_empty() {
        return Err(app_error(
            "api_invalid_response",
            "Le panel a répondu sans identifiant de compte exploitable.",
        ));
    }
    Ok(PanelAccount {
        id: attributes.id.unwrap_or(0),
        username,
        email,
        display_name,
        admin: attributes.root_admin.unwrap_or(false) || attributes.admin.unwrap_or(false),
    })
}

fn deserialize_success<T: DeserializeOwned>(
    status: reqwest::StatusCode,
    bytes: &[u8],
) -> Result<T> {
    // Several panel delete/revoke endpoints correctly return HTTP 204 with no
    // JSON body. serde_json::Value accepts null, but strict structures do not.
    let body = if status == reqwest::StatusCode::NO_CONTENT && bytes.is_empty() {
        b"null".as_slice()
    } else {
        bytes
    };
    serde_json::from_slice(body).map_err(|_| {
        app_error(
            "api_invalid_response",
            "Réponse de l'API du panneau illisible.",
        )
    })
}

/// Preserve structured panel API errors. A JSON object cannot be
/// deserialized as a borrowed byte slice and then parsed a second time.
fn parse_panel_error_detail(status: reqwest::StatusCode, bytes: &[u8]) -> String {
    let error_value: Option<Value> = serde_json::from_slice(bytes).ok();
    error_value
        .as_ref()
        .and_then(|value| value.get("message").and_then(Value::as_str))
        .or_else(|| {
            error_value
                .as_ref()
                .and_then(|value| value.get("errors").and_then(Value::as_array))
                .and_then(|errors| errors.first())
                .and_then(|error| error.get("detail").and_then(Value::as_str))
        })
        .map(str::to_owned)
        .unwrap_or_else(|| format!("Réponse HTTP {status}"))
}

impl ApiClient {
    pub fn new(base_url: &str, token: &str, accept: &str, allow_local: bool) -> Result<Self> {
        if base_url.trim().is_empty() {
            return Err(app_error("api_config", "L'URL du panneau est requise."));
        }
        if token.trim().is_empty() {
            return Err(app_error(
                "api_token",
                "Le jeton API du panneau est requis.",
            ));
        }
        crate::security::url::validate_panel_url(base_url, allow_local)?;
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
            accept: accept.to_string(),
            allow_local,
        })
    }

    pub(crate) async fn send_json<T: DeserializeOwned>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<T> {
        let base = crate::security::url::validate_panel_url(&self.base_url, self.allow_local)?;
        // DNS is checked on EVERY operation and pinned for the connection.
        // This prevents the client from resolving a different private address after validation.
        let resolved = crate::security::url::resolve_allowed_addrs(&base, self.allow_local).await?;
        let host = base
            .host_str()
            .ok_or_else(|| app_error("invalid_url", "Hôte du panneau manquant."))?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .https_only(true)
            .resolve_to_addrs(host, &resolved)
            .build()
            .map_err(|_| app_error("api_client", "Le client HTTP est indisponible."))?;
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let mut builder = client
            .request(method, &url)
            .bearer_auth(&self.token)
            .header(reqwest::header::ACCEPT, self.accept.clone())
            .header(
                reqwest::header::USER_AGENT,
                format!("HebergTonServ-Desktop/{}", env!("CARGO_PKG_VERSION")),
            );
        if let Some(b) = body {
            let payload = serde_json::to_vec(b)
                .map_err(|_| app_error("api_invalid_request", "Requête API invalide."))?;
            if payload.len() > crate::security::url::MAX_REQUEST_BODY_BYTES {
                return Err(app_error(
                    "api_request_too_large",
                    "Requête du panneau trop volumineuse.",
                ));
            }
            builder = builder
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(payload);
        }
        let mut response = builder
            .send()
            .await
            .map_err(|_| app_error("api_network", "Connexion au panneau refusée."))?;
        let status = response.status();
        // Apply the same bound to declared lengths and streamed chunks.
        if response
            .content_length()
            .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
        {
            return Err(app_error(
                "api_response_too_large",
                "Réponse du panneau trop volumineuse.",
            ));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| app_error("api_network", "Réponse du panneau illisible."))?
        {
            append_bounded_response_chunk(&mut bytes, &chunk)?;
        }
        if !status.is_success() {
            let detail = parse_panel_error_detail(status, bytes.as_ref());
            return Err(http_error(http_error_code(status), detail));
        }
        deserialize_success(status, bytes.as_ref())
    }

    pub async fn get_account_wisp(&self) -> Result<Option<PanelUser>> {
        let response = self
            .send_json::<Value>(reqwest::Method::GET, "/api/client/auth/@me", None)
            .await?;
        parse_account_user(response)
    }

    pub async fn validate_wisp_token(&self) -> Result<PanelAccount> {
        let user = self.get_account_wisp().await?.ok_or_else(|| {
            app_error(
                "api_invalid_response",
                "Le panel a répondu sans compte WISP; tentative du format Pterodactyl Client API.",
            )
        })?;
        account_from_user(user)
    }

    pub async fn get_account_pterodactyl(&self) -> Result<Option<PanelUser>> {
        let client = ApiClient::new(
            &self.base_url,
            &self.token,
            "application/json",
            self.allow_local,
        )?;
        let response = client
            .send_json::<Value>(reqwest::Method::GET, "/api/client/account", None)
            .await?;
        parse_account_user(response)
    }

    pub async fn list_servers(&self, accept: &str) -> Result<Vec<PanelServer>> {
        const PAGE_SIZE: u64 = 25;
        const MAX_PAGES: u64 = 500;
        let client = ApiClient::new(&self.base_url, &self.token, accept, self.allow_local)?;
        let mut servers = Vec::new();
        for page in 1..=MAX_PAGES {
            let path = format!(
                "/api/client/servers?per_page={PAGE_SIZE}&page={page}&include=node,egg,allocations"
            );
            let response = client
                .send_json::<Value>(reqwest::Method::GET, &path, None)
                .await?;
            let data = response
                .get("data")
                .and_then(Value::as_array)
                .ok_or_else(|| {
                    app_error(
                        "api_invalid_response",
                        "La liste des serveurs renvoyée par le panel est invalide.",
                    )
                })?;
            if data.is_empty() {
                break;
            }
            for server in data {
                servers.push(parse_server(server.clone())?);
            }
            let pagination: PaginationMeta = response
                .get("meta")
                .cloned()
                .and_then(|meta| serde_json::from_value(meta).ok())
                .unwrap_or_default();
            let has_next = pagination
                .pagination
                .links
                .next
                .as_ref()
                .is_some_and(|next| !next.is_empty());
            let total_pages = pagination.pagination.total_pages;
            let count = pagination.pagination.count;
            if (total_pages > 0 && page >= total_pages)
                || (total_pages == 0 && !has_next && count < PAGE_SIZE)
                || (total_pages == 0 && !has_next && data.len() < PAGE_SIZE as usize)
            {
                break;
            }
        }
        if servers.len() >= (MAX_PAGES * PAGE_SIZE) as usize {
            return Err(app_error(
                "api_pagination_limit",
                "Le panel contient trop de pages de serveurs pour une seule synchronisation.",
            ));
        }
        Ok(servers)
    }

    pub async fn get_server_resources(
        &self,
        accept: &str,
        server_identifier: &str,
    ) -> Result<PanelServerResources> {
        if server_identifier.is_empty()
            || !server_identifier.chars().all(|character| {
                character.is_ascii_alphanumeric() || character == '-' || character == '_'
            })
        {
            return Err(app_error(
                "api_invalid_request",
                "Identifiant de serveur invalide.",
            ));
        }
        let client = ApiClient::new(&self.base_url, &self.token, accept, self.allow_local)?;
        let response = client
            .send_json::<Value>(
                reqwest::Method::GET,
                &format!("/api/client/servers/{server_identifier}/resources"),
                None,
            )
            .await?;
        Ok(parse_server_resources(response))
    }

    pub async fn get_account(&self) -> Result<PanelAccount> {
        self.get_account_with_api()
            .await
            .map(|(account, _)| account)
    }

    pub async fn get_account_with_api(&self) -> Result<(PanelAccount, AccountApi)> {
        match self.get_account_wisp().await {
            Ok(Some(user)) => match account_from_user(user) {
                Ok(account) => Ok((account, AccountApi::Wisp)),
                Err(error) if fallback_to_pterodactyl(error.code()) => self
                    .get_pterodactyl_account()
                    .await
                    .map(|account| (account, AccountApi::Pterodactyl)),
                Err(error) => Err(error),
            },
            Ok(None) => self
                .get_pterodactyl_account()
                .await
                .map(|account| (account, AccountApi::Pterodactyl)),
            Err(error) if fallback_to_pterodactyl(error.code()) => self
                .get_pterodactyl_account()
                .await
                .map(|account| (account, AccountApi::Pterodactyl)),
            Err(error) => Err(error),
        }
    }

    async fn get_pterodactyl_account(&self) -> Result<PanelAccount> {
        let user = self.get_account_pterodactyl().await?.ok_or_else(|| {
            app_error(
                "api_invalid_response",
                "Les API WISP et Pterodactyl n'ont pas renvoyé de compte utilisateur.",
            )
        })?;
        account_from_user(user)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]

    fn limits_streamed_responses_without_reading_the_entire_body() {
        let mut payload = vec![0u8; MAX_RESPONSE_BYTES - 1];
        append_bounded_response_chunk(&mut payload, &[1]).unwrap();
        let error = append_bounded_response_chunk(&mut payload, &[2]).unwrap_err();
        assert_eq!(error.code(), "api_response_too_large");
    }

    #[test]
    fn rejects_oversized_single_chunk_before_allocation() {
        let mut payload = Vec::new();
        let chunk = vec![0u8; MAX_RESPONSE_BYTES + 1];
        assert!(append_bounded_response_chunk(&mut payload, &chunk).is_err());
        assert!(payload.is_empty());
    }

    #[test]
    fn preserves_panel_error_messages_for_authentication_failures() {
        let error = parse_panel_error_detail(
            reqwest::StatusCode::UNAUTHORIZED,
            br#"{"message":"API token invalid"}"#,
        );
        assert_eq!(error, "API token invalid");
        assert_eq!(
            http_error_code(reqwest::StatusCode::UNAUTHORIZED),
            "api_auth_failed"
        );
    }

    #[test]
    fn preserves_pterodactyl_error_details_and_falls_back_on_invalid_json() {
        let detail = parse_panel_error_detail(
            reqwest::StatusCode::FORBIDDEN,
            br#"{"errors":[{"detail":"Permission denied"}]}"#,
        );
        assert_eq!(detail, "Permission denied");
        let fallback = parse_panel_error_detail(reqwest::StatusCode::FORBIDDEN, b"{broken");
        assert!(fallback.starts_with("Réponse HTTP 403"));
    }

    #[test]
    fn rejects_missing_api_token_without_network_access() {
        let error = ApiClient::new("https://example.com", "   ", "application/json", false)
            .err()
            .expect("empty token must be rejected");
        assert_eq!(error.code(), "api_token");
    }

    #[test]
    fn rejects_insecure_panel_url_before_authentication() {
        let error = ApiClient::new(
            "http://example.com",
            "test-token",
            "application/json",
            false,
        )
        .err()
        .expect("HTTP URL must be rejected");
        assert_eq!(error.code(), "invalid_url");
    }

    #[test]
    fn never_retries_wisp_auth_failures_on_pterodactyl_api() {
        for status in [
            reqwest::StatusCode::UNAUTHORIZED,
            reqwest::StatusCode::FORBIDDEN,
            reqwest::StatusCode::TOO_MANY_REQUESTS,
        ] {
            assert!(!fallback_to_pterodactyl(http_error_code(status)));
        }
        assert_eq!(
            http_error_code(reqwest::StatusCode::UNAUTHORIZED),
            "api_auth_failed"
        );
        assert!(fallback_to_pterodactyl(http_error_code(
            reqwest::StatusCode::NOT_FOUND
        )));
        assert!(fallback_to_pterodactyl("api_invalid_response"));
        assert!(fallback_to_pterodactyl("api_error"));
        assert!(!fallback_to_pterodactyl("api_forbidden"));
        assert!(!fallback_to_pterodactyl("api_rate_limited"));
    }

    #[test]
    fn parses_documented_wisp_account_envelope_and_name_fields() {
        let value: Value = serde_json::from_str(
            r#"{"user":{"object":"user","attributes":{"id":3,"email":"client@example.test","name_first":"Ada","name_last":"Lovelace","root_admin":true}}}"#,
        ).unwrap();
        let user = parse_account_user(value).unwrap().unwrap();
        let account = account_from_user(user).unwrap();
        assert_eq!(account.id, 3);
        assert_eq!(account.email, "client@example.test");
        assert_eq!(account.display_name, "Ada Lovelace");
        assert!(account.admin);
    }

    #[test]
    fn parses_live_wisp_root_response_with_string_user_id() {
        let value: Value = serde_json::from_str(
            r#"{"object":"user","attributes":{"id":"user_test_12345","email":"client@example.test","name_first":"Ada","name_last":"Lovelace","root_admin":true,"has_servers":true}}"#,
        )
        .unwrap();
        let user = parse_account_user(value).unwrap().unwrap();
        let account = account_from_user(user).unwrap();
        assert_eq!(account.id, 0);
        assert_eq!(account.email, "client@example.test");
        assert_eq!(account.display_name, "Ada Lovelace");
        assert!(account.admin);
    }

    #[test]
    fn parses_wisp_and_pterodactyl_server_list_shapes() {
        let wisp = serde_json::json!({
            "uuid": "uuid-123", "uuidShort": "abc123", "name": "Serveur test",
            "description": "Description", "node": "game1", "egg": "Minecraft",
            "limits": {"memory": 4096, "disk": 8192, "cpu": 200, "databases": 2}
        });
        let parsed = parse_server(wisp).unwrap();
        assert_eq!(parsed.id, "uuid-123");
        assert_eq!(parsed.identifier, "abc123");
        assert_eq!(parsed.name, "Serveur test");
        assert_eq!(parsed.limits.memory, Some(4096));

        let pterodactyl = serde_json::json!({
            "attributes": {
                "uuid": "uuid-456", "identifier": "def456", "name": "Ptero",
                "node": "node-2", "egg": "FiveM", "limits": {"memory": 2048},
                "relationships": {"node": {"attributes": {"name": "node-2"}}}
            }
        });
        let parsed = parse_server(pterodactyl).unwrap();
        assert_eq!(parsed.identifier, "def456");
        assert_eq!(parsed.node.as_deref(), Some("node-2"));
    }

    #[test]
    fn reads_wisp_pagination_metadata() {
        let value = serde_json::json!({
            "meta": {"pagination": {"total_pages": 4, "current_page": 2, "count": 25, "links": {"next": "?page=3"}}}
        });
        let meta: PaginationMeta = serde_json::from_value(value["meta"].clone()).unwrap();
        assert_eq!(meta.pagination.total_pages, 4);
        assert_eq!(meta.pagination.current_page, 2);
        assert!(meta.pagination.links.next.is_some());
    }

    #[test]
    fn parses_pterodactyl_v2_root_user_response_without_wisp_envelope() {
        let value: Value = serde_json::from_str(
            r#"{"object":"user","attributes":{"id":22065,"admin":false,"username":"skye_42","email":"skye@example.test","first_name":"Skye","last_name":"Rogahn","language":"en"}}"#,
        ).unwrap();
        let user = parse_account_user(value).unwrap().unwrap();
        let account = account_from_user(user).unwrap();
        assert_eq!(account.id, 22065);
        assert_eq!(account.username, "skye_42");
        assert_eq!(account.display_name, "Skye Rogahn");
        assert!(!account.admin);
    }

    #[test]
    fn empty_wisp_user_envelope_is_a_fallback_case() {
        let value: Value = serde_json::from_str(r#"{"user":null}"#).unwrap();
        assert!(parse_account_user(value).unwrap().is_none());
        assert!(fallback_to_pterodactyl("api_invalid_response"));
    }

    #[test]
    fn accepts_empty_204_body_for_delete_responses() {
        let response: serde_json::Value = deserialize_success(reqwest::StatusCode::NO_CONTENT, b"")
            .expect("HTTP 204 is valid for successful deletion");
        assert!(response.is_null());
    }

    #[test]
    fn does_not_hide_invalid_json_in_successful_struct_responses() {
        let parsed = deserialize_success::<PanelListResponse<serde_json::Value>>(
            reqwest::StatusCode::OK,
            b"{not-valid-json",
        );
        assert!(parsed.is_err());
        assert_eq!(parsed.err().unwrap().code(), "api_invalid_response");
    }
}
