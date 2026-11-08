//! Official open-source Sign in with ChatGPT / Responses API integration.
//! No private chatgpt.com/backend-api requests, API keys, or web cookies.
//! Tokens remain on the native Rust side and in the OS credential vault.
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const AUTH_URL: &str = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_URL: &str = "https://auth.openai.com/api/accounts/oauth/token";
const JWKS_URL: &str = "https://auth.openai.com/.well-known/jwks.json";
const RESOURCE: &str = "https://api.openai.com/v1";
const MODELS_URL: &str = "https://api.openai.com/v1/models";
const RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
// Separate experimental identities from stable credentials to avoid leaking
// sign-in state across side-by-side installed Tauri app identities.
fn credential_service() -> &'static str {
    if env!("CARGO_PKG_VERSION").contains('-') {
        "hebergtonserv-desktop.preview.chatgpt-plan"
    } else {
        "hebergtonserv-desktop.chatgpt-plan"
    }
}
const ACCOUNT_KEY: &str = "active";
const HOST_KEY: &str = "host-id";
const SCOPE: &str = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";

#[derive(Default)]
pub struct PlanState {
    login_busy: Arc<AtomicBool>,
    in_flight: AtomicBool,
    refresh_lock: tokio::sync::Mutex<()>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    connected: bool,
    plan_enabled: bool,
    account: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthEvent {
    success: bool,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanModel {
    id: String,
    name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDelta {
    run_id: String,
    delta: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanReply {
    text: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct Account {
    client_id: String,
    subject: String,
    email: Option<String>,
    host_id: String,
    id_token: String,
    access_token: String,
    refresh_token: String,
    scopes: Vec<String>,
    expires_at: u64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    scope: Option<String>,
    expires_in: Option<u64>,
    token_type: Option<String>,
}

#[derive(Deserialize)]
struct IdentityClaims {
    sub: String,
    iss: String,
    aud: Value,
    exp: u64,
    nonce: Option<String>,
    email: Option<String>,
}

fn epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn credential(field: &str) -> Result<Entry, String> {
    Entry::new(credential_service(), field)
        .map_err(|_| "Coffre de secrets Windows indisponible.".to_string())
}

fn get_host_id() -> Result<String, String> {
    let entry = credential(HOST_KEY)?;
    if let Ok(id) = entry.get_password()
        && id.starts_with("urn:uuid:")
        && id.len() == 45
    {
        return Ok(id);
    }
    let host = format!("urn:uuid:{}", uuid::Uuid::new_v4());
    entry
        .set_password(&host)
        .map_err(|_| "Impossible de conserver l'identifiant de ce poste.".to_string())?;
    Ok(host)
}

fn chunked_key(bank: &str, index: usize) -> String {
    format!("account-{bank}-{index}")
}

fn parse_bank_marker(marker: &str) -> Result<(&str, usize), String> {
    let (bank, num) = marker
        .split_once(':')
        .ok_or("Marqueur de coffre invalide.")?;
    if !matches!(bank, "a" | "b") {
        return Err("Banque de coffre inconnue.".into());
    }
    let count = num
        .parse::<usize>()
        .map_err(|_| "Nombre de fragments OAuth invalide.".to_string())?;
    if !(1..=64).contains(&count) {
        return Err("Taille de session OAuth invalide.".into());
    }
    Ok((bank, count))
}

fn clear_bank(bank: &str) {
    for index in 0..64 {
        if let Ok(entry) = credential(&chunked_key(bank, index)) {
            let _ = entry.delete_credential();
        }
    }
}

fn read_account() -> Result<Option<Account>, String> {
    let marker = match credential(ACCOUNT_KEY)?.get_password() {
        Ok(raw) => raw,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(_) => return Err("Coffre Windows indisponible pour la session ChatGPT.".into()),
    };
    let raw = if marker.starts_with('{') {
        marker
    } else {
        let (bank, count) = parse_bank_marker(&marker)?;
        let mut encoded = String::new();
        for index in 0..count {
            let part = credential(&chunked_key(bank, index))?
                .get_password()
                .map_err(|_| "Un fragment sécurisé du compte ChatGPT est manquant.".to_string())?;
            if part.len() > 1000 {
                return Err("Fragment sécurisé trop volumineux.".into());
            }
            encoded.push_str(&part);
        }
        let data = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|_| "Données du coffre ChatGPT corrompues.".to_string())?;
        String::from_utf8(data).map_err(|_| "Identifiants OAuth illisibles.".to_string())?
    };
    let account = serde_json::from_str(&raw)
        .map_err(|_| "Compte ChatGPT enregistré illisible : reconnectez-vous.".to_string())?;
    Ok(Some(account))
}

fn save_account(account: &Account) -> Result<(), String> {
    let serialized = serde_json::to_vec(account)
        .map_err(|_| "Impossible d'encoder la session ChatGPT.".to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(serialized);
    let chunks: Vec<_> = encoded.as_bytes().chunks(900).collect();
    if chunks.is_empty() || chunks.len() > 64 {
        return Err("Session ChatGPT trop volumineuse.".into());
    }
    let entry = credential(ACCOUNT_KEY)?;
    let previous = entry.get_password().ok();
    let old_bank = previous
        .as_deref()
        .and_then(|v| parse_bank_marker(v).ok())
        .map(|(v, _)| v);
    let next = if old_bank == Some("a") { "b" } else { "a" };
    for (index, part) in chunks.iter().enumerate() {
        let fragment =
            std::str::from_utf8(part).map_err(|_| "Fragment OAuth invalide.".to_string())?;
        credential(&chunked_key(next, index))?
            .set_password(fragment)
            .map_err(|_| {
                "Impossible de conserver le jeton ChatGPT dans le coffre Windows.".to_string()
            })?;
    }
    entry
        .set_password(&format!("{next}:{}", chunks.len()))
        .map_err(|_| "Impossible d'activer la session sécurisée.".to_string())?;
    clear_bank(if next == "a" { "b" } else { "a" });
    Ok(())
}

fn delete_account() -> Result<(), String> {
    match credential(ACCOUNT_KEY)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(_) => return Err("Impossible d'effacer la session du coffre Windows.".into()),
    }
    clear_bank("a");
    clear_bank("b");
    Ok(())
}

fn status(account: Option<&Account>) -> AuthStatus {
    AuthStatus {
        connected: account.is_some(),
        plan_enabled: account
            .is_some_and(|a| a.scopes.iter().any(|s| s == "chatgpt.tokens.use.direct")),
        account: account.and_then(|a| a.email.clone()),
    }
}

fn scopes(raw: &str) -> Vec<String> {
    raw.split_whitespace().map(str::to_string).collect()
}

fn random_pkce() -> (String, String) {
    // 64 hex characters, generated with UUID v4 OS randomness; PKCE requires 43..128.
    let verifier = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(175))
        .connect_timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Impossible de configurer la connexion HTTPS sécurisée.".to_string())
}

fn build_authorization_url(
    host_id: &str,
    saved: Option<&Account>,
    redirect: &str,
    state: &str,
    nonce: &str,
    challenge: &str,
) -> Result<String, String> {
    let mut url = url::Url::parse(AUTH_URL).map_err(|_| "URL OAuth invalide.".to_string())?;
    {
        let mut q = url.query_pairs_mut();
        q.append_pair(
            "client_id",
            saved.map_or("dynamic_agent_client", |a| &a.client_id),
        );
        if saved.is_none() {
            q.append_pair("agent_name_hint", "HébergTonServ Desktop");
        }
        q.append_pair("ext_agent_host_id", host_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", redirect)
            .append_pair("scope", SCOPE)
            .append_pair("resource", RESOURCE)
            .append_pair("state", state)
            .append_pair("nonce", nonce)
            .append_pair("code_challenge_method", "S256")
            .append_pair("code_challenge", challenge);
        if let Some(a) = saved {
            q.append_pair("id_token_hint", &a.id_token);
            if let Some(email) = &a.email {
                q.append_pair("login_hint", email);
            }
        }
    }
    Ok(url.to_string())
}

async fn validate_id_token(
    client: &reqwest::Client,
    raw: &str,
    expected_client: &str,
    expected_nonce: Option<&str>,
) -> Result<IdentityClaims, String> {
    let header =
        decode_header(raw).map_err(|_| "En-tête du jeton d'identité invalide.".to_string())?;
    if header.alg != Algorithm::RS256 {
        return Err("Algorithme de signature d'identité inattendu.".into());
    }
    let kid = header
        .kid
        .as_deref()
        .ok_or("Identifiant de signature absent.")?;
    let keys: Value = client
        .get(JWKS_URL)
        .send()
        .await
        .map_err(|_| "Impossible de récupérer les clés de signature officielles.".to_string())?
        .error_for_status()
        .map_err(|_| "Clés de signature officielles indisponibles.".to_string())?
        .json()
        .await
        .map_err(|_| "Clés de signature invalides.".to_string())?;
    let key = keys["keys"]
        .as_array()
        .and_then(|items| {
            items.iter().find(|k| {
                k["kid"].as_str() == Some(kid)
                    && k["kty"].as_str() == Some("RSA")
                    && k["alg"].as_str() == Some("RS256")
            })
        })
        .ok_or("Clé de signature du jeton d'identité inconnue.")?;
    let n = key["n"].as_str().ok_or("Clé RSA incomplète.")?;
    let e = key["e"].as_str().ok_or("Exposant RSA manquant.")?;
    let decoding = DecodingKey::from_rsa_components(n, e)
        .map_err(|_| "Clé de signature invalide.".to_string())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[expected_client]);
    validation.set_issuer(&["https://auth.openai.com"]);
    let claims = decode::<IdentityClaims>(raw, &decoding, &validation)
        .map_err(|_| "Signature ou identité OpenAI non valide.".to_string())?
        .claims;
    if claims.iss != "https://auth.openai.com" || claims.sub.is_empty() || claims.exp <= epoch() {
        return Err("Émetteur, identité ou expiration du compte invalide.".into());
    }
    if let Some(nonce) = expected_nonce
        && claims.nonce.as_deref() != Some(nonce)
    {
        return Err("Nonce OAuth invalide.".into());
    }
    if !audience_matches(&claims.aud, expected_client) {
        return Err("Audience du jeton d'identité invalide.".into());
    }
    Ok(claims)
}

fn audience_matches(aud: &Value, client: &str) -> bool {
    aud.as_str() == Some(client)
        || aud
            .as_array()
            .is_some_and(|list| list.iter().any(|v| v.as_str() == Some(client)))
}

async fn exchange_code(
    client: &reqwest::Client,
    client_id: &str,
    redirect: &str,
    code: &str,
    verifier: &str,
) -> Result<TokenResponse, String> {
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", client_id),
            ("code", code),
            ("code_verifier", verifier),
            ("redirect_uri", redirect),
            ("resource", RESOURCE),
        ])
        .send()
        .await
        .map_err(|_| "Échange OAuth indisponible.".to_string())?;
    if !response.status().is_success() {
        return Err("Échange OAuth refusé. Relancez la connexion ChatGPT.".into());
    }
    response
        .json::<TokenResponse>()
        .await
        .map_err(|_| "Réponse OAuth non conforme.".to_string())
}

struct AuthAttempt {
    state: String,
    nonce: String,
    verifier: String,
    redirect: String,
    saved: Option<Account>,
    host_id: String,
}

async fn complete_login(
    client: &reqwest::Client,
    params: &url::Url,
    attempt: &AuthAttempt,
) -> Result<(), String> {
    let query: std::collections::HashMap<_, _> = params
        .query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    if query.get("state").map(String::as_str) != Some(attempt.state.as_str()) {
        return Err("État OAuth invalide : connexion rejetée.".into());
    }
    if query.contains_key("error") {
        return Err("Autorisation ChatGPT refusée ou annulée.".into());
    }
    let client_id = match attempt.saved.as_ref() {
        Some(a) => {
            if query.get("client_id").is_some_and(|id| id != &a.client_id) {
                return Err("Le client OAuth ne correspond pas au compte enregistré.".into());
            }
            a.client_id.clone()
        }
        None => {
            let issued = query
                .get("client_id")
                .ok_or("Enregistrement OAuth incomplet.")?;
            if !issued.starts_with("oaiapp_") || issued.len() > 256 {
                return Err("Identifiant client OAuth non valide.".into());
            }
            issued.to_string()
        }
    };
    let code = query.get("code").ok_or("Code d'autorisation manquant.")?;
    let tokens = exchange_code(
        client,
        &client_id,
        &attempt.redirect,
        code,
        &attempt.verifier,
    )
    .await?;
    if tokens
        .token_type
        .as_deref()
        .is_some_and(|kind| !kind.eq_ignore_ascii_case("bearer"))
    {
        return Err("Type de jeton OAuth inattendu.".into());
    }
    let token = tokens
        .id_token
        .as_deref()
        .ok_or("Jeton d'identité OpenAI manquant.")?;
    let claims = validate_id_token(client, token, &client_id, Some(&attempt.nonce)).await?;
    if attempt
        .saved
        .as_ref()
        .is_some_and(|a| a.subject != claims.sub)
    {
        return Err(
            "Ce compte ChatGPT ne correspond pas au compte précédemment enregistré.".into(),
        );
    }
    let granted = scopes(tokens.scope.as_deref().unwrap_or(""));
    if !granted.iter().any(|s| s == "chatgpt.tokens.use.direct") {
        return Err("La permission d'utiliser le forfait ChatGPT n'a pas été accordée.".into());
    }
    if tokens.access_token.is_empty() || tokens.refresh_token.as_deref().unwrap_or("").is_empty() {
        return Err("Les jetons OAuth requis sont absents.".into());
    }
    save_account(&Account {
        client_id,
        subject: claims.sub,
        email: claims.email,
        host_id: attempt.host_id.clone(),
        id_token: token.to_owned(),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token.unwrap_or_default(),
        scopes: granted,
        expires_at: epoch().saturating_add(tokens.expires_in.unwrap_or(3600)),
    })
}

async fn listen_callback(
    listener: TcpListener,
    client: reqwest::Client,
    attempt: AuthAttempt,
) -> Result<(), String> {
    tokio::time::timeout(Duration::from_secs(360), async {
        loop {
            let (mut socket, addr) = listener.accept().await
                .map_err(|_| "Retour OAuth local impossible.".to_string())?;
            if !addr.ip().is_loopback() {
                continue;
            }
            let mut data = Vec::new();
            let mut chunk = [0u8; 1024];
            while !data.windows(4).any(|v| v == b"\r\n\r\n") && data.len() < 8192 {
                let size = tokio::time::timeout(Duration::from_secs(5), socket.read(&mut chunk))
                    .await.map_err(|_| "Retour OAuth trop lent.".to_string())?
                    .map_err(|_| "Lecture OAuth impossible.".to_string())?;
                if size == 0 { break; }
                data.extend_from_slice(&chunk[..size]);
            }
            let line = String::from_utf8_lossy(&data);
            let first = line.lines().next().unwrap_or("");
            let Some(path) = first.strip_prefix("GET ").and_then(|v| v.split(' ').next()) else {
                continue;
            };
            let Ok(callback) = url::Url::parse(&format!("http://127.0.0.1{path}")) else {
                continue;
            };
            if callback.path() != "/auth/callback" {
                continue;
            }
            // A random local request with an incorrect state cannot terminate login.
            let expected = callback.query_pairs().any(|(k,v)| k == "state" && v == attempt.state);
            if !expected {
                let _ = socket.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                continue;
            }
            let result = complete_login(&client, &callback, &attempt).await;
            let body = if result.is_ok() {
                "HébergTonServ Desktop : connexion ChatGPT terminée. Vous pouvez fermer cet onglet."
            } else {
                "HébergTonServ Desktop : autorisation non terminée. Retournez dans l'application."
            };
            let reply = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(), body
            );
            let _ = socket.write_all(reply.as_bytes()).await;
            return result;
        }
    }).await.map_err(|_| "Connexion ChatGPT expirée après six minutes.".to_string())?
}

fn require_main_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Cette fonction ChatGPT est réservée à la fenêtre principale.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn chatgpt_plan_login(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: tauri::State<'_, PlanState>,
) -> Result<String, String> {
    require_main_window(&window)?;
    if state.login_busy.swap(true, Ordering::SeqCst) {
        return Err("Une connexion ChatGPT est déjà en cours.".into());
    }
    let flag = Arc::clone(&state.login_busy);
    let result: Result<String, String> = async {
        let host = get_host_id()?;
        let saved = read_account()?;
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|_| "Impossible d'ouvrir un port OAuth local.".to_string())?;
        let port = listener
            .local_addr()
            .map_err(|_| "Port OAuth invalide.".to_string())?
            .port();
        let redirect = format!("http://127.0.0.1:{port}/auth/callback");
        let state = uuid::Uuid::new_v4().to_string();
        let nonce = uuid::Uuid::new_v4().to_string();
        let (verifier, challenge) = random_pkce();
        let link =
            build_authorization_url(&host, saved.as_ref(), &redirect, &state, &nonce, &challenge)?;
        let client = http()?;
        tauri::async_runtime::spawn(async move {
            let outcome = listen_callback(
                listener,
                client,
                AuthAttempt {
                    state,
                    nonce,
                    verifier,
                    redirect,
                    saved,
                    host_id: host,
                },
            )
            .await;
            flag.store(false, Ordering::SeqCst);
            let notice = match outcome {
                Ok(()) => AuthEvent {
                    success: true,
                    message: "ChatGPT autorisé pour la Responses API.".into(),
                },
                Err(message) => AuthEvent {
                    success: false,
                    message,
                },
            };
            let _ = app.emit_to("main", "hts:plan-auth", notice);
        });
        Ok(link)
    }
    .await;
    if result.is_err() {
        state.login_busy.store(false, Ordering::SeqCst);
    }
    result
}

#[tauri::command]
pub fn chatgpt_plan_status(window: tauri::WebviewWindow) -> Result<AuthStatus, String> {
    require_main_window(&window)?;
    let account = read_account()?;
    Ok(status(account.as_ref()))
}

async fn access_token(state: &PlanState) -> Result<String, String> {
    let _guard = state.refresh_lock.lock().await;
    let mut account = read_account()?.ok_or("Connectez d'abord un compte ChatGPT.".to_string())?;
    if !account
        .scopes
        .iter()
        .any(|s| s == "chatgpt.tokens.use.direct")
    {
        return Err("L'utilisation du forfait ChatGPT n'est pas autorisée.".into());
    }
    if account.expires_at > epoch().saturating_add(60) {
        return Ok(account.access_token);
    }
    let client = http()?;
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", account.client_id.as_str()),
            ("refresh_token", account.refresh_token.as_str()),
            ("resource", RESOURCE),
        ])
        .send()
        .await
        .map_err(|_| "Impossible de renouveler la session ChatGPT.".to_string())?;
    if !response.status().is_success() {
        return Err("Session ChatGPT expirée ou révoquée : reconnectez-vous.".into());
    }
    let tokens = response
        .json::<TokenResponse>()
        .await
        .map_err(|_| "Réponse de renouvellement non valide.".to_string())?;
    if tokens.access_token.is_empty() {
        return Err("Jeton d'accès renouvelé manquant.".into());
    }
    if let Some(id_token) = tokens.id_token {
        let identity = validate_id_token(&client, &id_token, &account.client_id, None).await?;
        if identity.sub != account.subject {
            return Err("L'identité du compte a changé : renouvellement refusé.".into());
        }
        account.id_token = id_token;
    }
    if let Some(refresh_token) = tokens.refresh_token {
        if refresh_token.is_empty() {
            return Err("Jeton renouvelable invalide.".into());
        }
        account.refresh_token = refresh_token;
    }
    if let Some(granted) = tokens.scope {
        account.scopes = scopes(&granted);
    }
    if !account
        .scopes
        .iter()
        .any(|s| s == "chatgpt.tokens.use.direct")
    {
        return Err("Le forfait ChatGPT n'est plus autorisé pour l'application.".into());
    }
    account.expires_at = epoch().saturating_add(tokens.expires_in.unwrap_or(3600));
    account.access_token = tokens.access_token;
    save_account(&account)?;
    Ok(account.access_token)
}

async fn available_models(state: &PlanState) -> Result<Vec<PlanModel>, String> {
    let token = access_token(state).await?;
    let response = http()?
        .get(MODELS_URL)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|_| "Catalogue des modèles ChatGPT indisponible.".to_string())?;
    if !response.status().is_success() {
        return Err("Impossible de consulter les modèles autorisés du compte ChatGPT.".into());
    }
    let value: Value = response
        .json()
        .await
        .map_err(|_| "Catalogue des modèles illisible.".to_string())?;
    let mut models = Vec::new();
    for entry in value["models"]
        .as_array()
        .ok_or("Liste officielle des modèles manquante.")?
    {
        if entry["visibility"].as_str() != Some("list") {
            continue;
        }
        let Some(id) = entry["slug"].as_str() else {
            continue;
        };
        if id.is_empty() || id.len() > 128 {
            continue;
        }
        models.push(PlanModel {
            id: id.to_string(),
            name: entry["display_name"].as_str().unwrap_or(id).to_string(),
        });
    }
    Ok(models)
}

#[tauri::command]
pub async fn chatgpt_plan_models(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, PlanState>,
) -> Result<Vec<PlanModel>, String> {
    require_main_window(&window)?;
    available_models(&state).await
}

#[derive(Deserialize)]
pub struct ChatTurn {
    role: String,
    content: String,
}

fn validate_turns(turns: &[ChatTurn]) -> Result<(), String> {
    if turns.is_empty()
        || turns.len() > 20
        || turns.last().is_none_or(|turn| turn.role != "user")
        || turns.iter().any(|t| {
            !matches!(t.role.as_str(), "user" | "assistant")
                || t.content.trim().is_empty()
                || t.content.len() > 8000
        })
    {
        return Err("Historique de discussion invalide ou trop volumineux.".into());
    }
    Ok(())
}

fn parse_sse_frame(frame: &[u8]) -> Result<Option<Value>, String> {
    let text = std::str::from_utf8(frame).map_err(|_| "Événement SSE non UTF-8.".to_string())?;
    let data = text
        .lines()
        .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
        .collect::<Vec<_>>()
        .join("\n");
    if data.is_empty() || data == "[DONE]" {
        return Ok(None);
    }
    serde_json::from_str(&data)
        .map(Some)
        .map_err(|_| "Événement SSE malformé.".to_string())
}

fn take_frame(buffer: &mut Vec<u8>) -> Option<Vec<u8>> {
    let normalized = buffer.windows(2).position(|w| w == b"\n\n");
    let windows_style = buffer.windows(4).position(|w| w == b"\r\n\r\n");
    let (start, length) = match (normalized, windows_style) {
        (Some(a), Some(b)) if a < b => (a, 2),
        (Some(_), Some(b)) => (b, 4),
        (Some(a), _) => (a, 2),
        (None, Some(b)) => (b, 4),
        (None, None) => return None,
    };
    let frame: Vec<u8> = buffer.drain(..start + length).collect();
    Some(frame[..start].to_vec())
}

#[tauri::command]
pub async fn chatgpt_plan_message(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, PlanState>,
    app: AppHandle,
    run_id: String,
    model: String,
    turns: Vec<ChatTurn>,
) -> Result<PlanReply, String> {
    require_main_window(&window)?;
    if uuid::Uuid::parse_str(&run_id).is_err() {
        return Err("Identifiant de requête invalide.".into());
    }
    validate_turns(&turns)?;
    if state.in_flight.swap(true, Ordering::SeqCst) {
        return Err("Une réponse ChatGPT est déjà en cours.".into());
    }
    struct Reset<'a>(&'a AtomicBool);
    impl Drop for Reset<'_> {
        fn drop(&mut self) {
            self.0.store(false, Ordering::SeqCst);
        }
    }
    let _reset = Reset(&state.in_flight);
    let models = available_models(&state).await?;
    if !models.iter().any(|entry| entry.id == model) {
        return Err("Ce modèle n'est pas disponible pour le compte connecté.".into());
    }
    let token = access_token(&state).await?;
    let input: Vec<Value> = turns
        .into_iter()
        .map(|t| json!({"role":t.role,"content":t.content}))
        .collect();
    let response = http()?
        .post(RESPONSES_URL)
        .bearer_auth(&token)
        .json(&json!({"model":model,"input":input,"store":false,"stream":true}))
        .send()
        .await
        .map_err(|_| "La requête ChatGPT n'a pas pu être envoyée.".to_string())?;
    if !response.status().is_success() {
        return Err(if response.status().as_u16() == 429 {
            "Le quota du forfait ChatGPT est atteint.".into()
        } else if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
            "Accès au forfait refusé ou session expirée. Reconnectez-vous.".into()
        } else {
            format!(
                "La Responses API a refusé la requête (HTTP {}).",
                response.status().as_u16()
            )
        });
    }
    let mut response = response;
    let mut buffer = Vec::new();
    let mut answer = String::new();
    let mut completed = false;
    tokio::time::timeout(Duration::from_secs(150), async {
        while let Some(chunk) = response.chunk().await.map_err(|_| "Le flux ChatGPT a été interrompu.".to_string())? {
            buffer.extend_from_slice(&chunk);
            if buffer.len() > 512_000 {
                return Err("Événement ChatGPT trop volumineux.".into());
            }
            while let Some(frame) = take_frame(&mut buffer) {
                let Some(data) = parse_sse_frame(&frame)? else { continue; };
                match data["type"].as_str() {
                    Some("response.output_text.delta") => {
                        if let Some(delta) = data["delta"].as_str() {
                            if answer.len() + delta.len() > 200_000 {
                                return Err("Réponse trop longue.".into());
                            }
                            answer.push_str(delta);
                            let _ = app.emit_to("main", "hts:plan-delta", PlanDelta {
                                run_id: run_id.clone(), delta: delta.to_string(),
                            });
                        }
                    }
                    Some("response.completed") => {
                        completed = true;
                    }
                    Some("response.failed" | "response.incomplete") => {
                        return Err("La réponse ChatGPT a échoué ou a été interrompue (vérifiez le quota du forfait).".into());
                    }
                    Some("error") => {
                        return Err("La Responses API a signalé une erreur.".into());
                    }
                    _ => {}
                }
            }
        }
        Ok::<(), String>(())
    }).await.map_err(|_| "Délai de réponse ChatGPT dépassé.".to_string())??;
    if !completed {
        return Err("Le flux s'est terminé sans événement response.completed.".into());
    }
    Ok(PlanReply { text: answer })
}

#[tauri::command]
pub async fn chatgpt_plan_logout(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, PlanState>,
) -> Result<(), String> {
    require_main_window(&window)?;
    if state.in_flight.load(Ordering::SeqCst) {
        return Err("Arrêtez d'abord la réponse en cours.".into());
    }
    let _guard = state.refresh_lock.lock().await;
    let account = read_account()?;
    if let Some(account) = account {
        // Revocation is best-effort; do not claim remote revocation if network fails.
        let revoked = http()?
            .post("https://auth.openai.com/api/accounts/oauth/revoke")
            .form(&[
                ("client_id", account.client_id.as_str()),
                ("token", account.refresh_token.as_str()),
                ("token_type_hint", "refresh_token"),
            ])
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        delete_account()?;
        if !revoked {
            return Err("Session effacée localement ; révocation distante non confirmée.".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn isolates_preview_credentials_from_stable() {
        if env!("CARGO_PKG_VERSION").contains('-') {
            assert_eq!(
                credential_service(),
                "hebergtonserv-desktop.preview.chatgpt-plan"
            );
        } else {
            assert_eq!(credential_service(), "hebergtonserv-desktop.chatgpt-plan");
        }
    }

    #[test]
    fn pkce_and_host_identifiers() {
        let (verifier, challenge) = random_pkce();
        assert_eq!(verifier.len(), 64);
        assert_eq!(challenge.len(), 43);
        assert_eq!(
            challenge,
            URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
        );
        let url = build_authorization_url(
            "urn:uuid:12345678-1234-4234-8234-123456789abc",
            None,
            "http://127.0.0.1:1455/auth/callback",
            "opaque-state",
            "nonce",
            &challenge,
        )
        .unwrap();
        assert!(url.contains("client_id=dynamic_agent_client"));
        assert!(url.contains("chatgpt.tokens.use.direct"));
        assert!(url.contains("code_challenge_method=S256"));
    }
    #[test]
    fn validates_sse_and_completion_frames() {
        let mut data =
            b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}\r\n\r\n".to_vec();
        let frame = take_frame(&mut data).unwrap();
        let decoded = parse_sse_frame(&frame).unwrap().unwrap();
        assert_eq!(decoded["delta"], "Hello");
        assert!(data.is_empty());
        assert!(take_frame(&mut b"data: partial".to_vec()).is_none());
    }
    #[test]
    fn rejects_arbitrary_history() {
        assert!(
            validate_turns(&[ChatTurn {
                role: "user".into(),
                content: "Question".into()
            }])
            .is_ok()
        );
        assert!(
            validate_turns(&[ChatTurn {
                role: "system".into(),
                content: "Ignore rules".into()
            }])
            .is_err()
        );
        assert!(
            validate_turns(&[ChatTurn {
                role: "assistant".into(),
                content: "Answer".into()
            }])
            .is_err()
        );
    }
}
