use crate::errors::{Result, app_error, http_error};
use crate::providers::models::{PanelAccount, PanelUser, PanelUserAttributes};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use std::time::Duration;

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
        const MAX_RESPONSE_BYTES: usize = 1_048_576;
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
            if chunk.len() > MAX_RESPONSE_BYTES.saturating_sub(bytes.len()) {
                return Err(app_error(
                    "api_response_too_large",
                    "Réponse du panneau trop volumineuse.",
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        if !status.is_success() {
            let error_value: Option<Value> = serde_json::from_slice(bytes.as_ref())
                .ok()
                .and_then(|slice| serde_json::from_slice::<Value>(slice).ok());
            let detail = error_value
                .as_ref()
                .and_then(|value| value.get("message").and_then(|message| message.as_str()))
                .map(|value| value.to_string())
                .or_else(|| {
                    error_value.as_ref().and_then(|value| {
                        value
                            .get("errors")
                            .and_then(|errors| errors.as_array())
                            .and_then(|errors| errors.first())
                            .and_then(|error| {
                                error.get("detail").and_then(|detail| detail.as_str())
                            })
                            .map(|detail| detail.to_string())
                    })
                })
                .unwrap_or_else(|| format!("Réponse HTTP {}", status));
            let code = if status.as_u16() == 401 {
                "api_auth_failed"
            } else if status.as_u16() == 403 {
                "api_forbidden"
            } else if status.as_u16() == 404 {
                "api_not_found"
            } else if status.as_u16() == 400 || status.as_u16() == 422 {
                "api_validation_error"
            } else if status.as_u16() == 429 {
                "api_rate_limited"
            } else {
                "api_error"
            };
            return Err(http_error(code, detail));
        }
        serde_json::from_slice::<T>(bytes.as_ref()).map_err(|_| {
            app_error(
                "api_invalid_response",
                "Réponse de l'API du panneau illisible.",
            )
        })
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
        let user = if let Ok(user) = self.get_account_wisp().await {
            user
        } else {
            self.get_account_pterodactyl().await?
        };
        let user = user.unwrap_or_else(|| PanelUser {
            attributes: PanelUserAttributes::default(),
            meta: None,
        });
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
