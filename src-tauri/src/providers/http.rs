use crate::errors::{Result, app_error, http_error};
use crate::providers::models::{PanelAccount, PanelUser};
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
pub struct WispAccountResponse {
    pub user: Option<PanelUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PterodactylAccountResponse {
    #[serde(default)]
    pub user: PanelUser,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelListResponse<T> {
    #[serde(default)]
    pub data: Vec<T>,
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
    error_code == "api_not_found"
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
            .header(reqwest::header::ACCEPT, self.accept.clone());
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
            .send_json::<WispAccountResponse>(reqwest::Method::GET, "/api/client/auth/@me", None)
            .await?;
        Ok(response.user)
    }

    pub async fn get_account_pterodactyl(&self) -> Result<Option<PanelUser>> {
        let response = self
            .send_json::<PterodactylAccountResponse>(
                reqwest::Method::GET,
                "/api/client/account",
                None,
            )
            .await?;
        Ok(Some(response.user))
    }

    pub async fn get_account(&self) -> Result<PanelAccount> {
        let user = match self.get_account_wisp().await {
            Ok(Some(user)) => user,
            Ok(None) => {
                return Err(app_error(
                    "api_invalid_response",
                    "Le panneau n'a pas renvoyé de compte utilisateur.",
                ));
            }
            Err(error) if fallback_to_pterodactyl(error.code()) => {
                self.get_account_pterodactyl().await?.ok_or_else(|| {
                    app_error(
                        "api_invalid_response",
                        "Le panneau n'a pas renvoyé de compte utilisateur.",
                    )
                })?
            }
            Err(error) => return Err(error),
        };
        let attributes = user.attributes;
        let display_name = if attributes.first_name.is_some() || attributes.last_name.is_some() {
            format!(
                "{}{}",
                attributes.first_name.as_deref().unwrap_or(""),
                attributes.last_name.as_deref().unwrap_or("")
            )
        } else {
            attributes.username.clone().unwrap_or_default()
        };
        Ok(PanelAccount {
            id: attributes.id.unwrap_or(0),
            username: attributes.username.clone().unwrap_or_default(),
            email: attributes.email.clone().unwrap_or_default(),
            display_name,
            admin: attributes.root_admin.unwrap_or(false) || attributes.admin.unwrap_or(false),
        })
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
