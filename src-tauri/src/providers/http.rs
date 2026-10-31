use crate::errors::{Result, app_error, http_error};
use crate::providers::models::{PanelAccount, PanelUser, PanelUserAttributes};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use std::time::Duration;

const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;

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
    pub inner: reqwest::Client,
    pub base_url: String,
    pub token: String,
    pub accept: String,
}

impl ApiClient {
    pub fn new(base_url: &str, token: &str, accept: &str) -> Result<Self> {
        if base_url.trim().is_empty() {
            return Err(app_error("api_config", "L'URL du panneau est requise."));
        }
        if token.trim().is_empty() {
            return Err(app_error(
                "api_token",
                "Le jeton API du panneau est requis.",
            ));
        }
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .build()
            .map_err(|_| app_error("api_client", "Le client HTTP est indisponible."))?;
        Ok(Self {
            inner: client,
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
            accept: accept.to_string(),
        })
    }

    pub(crate) async fn send_json<T: DeserializeOwned>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<T> {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let mut builder = self
            .inner
            .request(method, &url)
            .bearer_auth(&self.token)
            .header(reqwest::header::ACCEPT, self.accept.clone());
        if let Some(b) = body {
            builder = builder.json(b);
        }
        let response = builder
            .send()
            .await
            .map_err(|_| app_error("api_network", "Connexion au panneau refusée."))?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|_| app_error("api_network", "Réponse du panneau illisible."))?;
        if bytes.len() > 1_048_576 {
            return Err(app_error(
                "api_response_too_large",
                "Réponse du panneau trop volumineuse.",
            ));
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
        if bytes.len() > MAX_BODY_BYTES {
            return Err(app_error(
                "api_payload_too_large",
                "Réponse du panneau trop volumineuse.",
            ));
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
