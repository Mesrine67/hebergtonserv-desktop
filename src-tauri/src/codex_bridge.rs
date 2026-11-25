//! Local Codex app-server bridge. No ChatGPT web cookies or private backend APIs.
//! Only an explicitly selected Codex executable is launched; never through a shell.
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::watch;

#[derive(Default)]
pub struct CodexSessionState {
    issued_ids: Mutex<HashSet<String>>,
    active_turns: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    login_active: Arc<AtomicBool>,
    mcp_root: Mutex<Option<PathBuf>>,
}

struct ActiveRunGuard {
    active: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    run_id: String,
}

impl Drop for ActiveRunGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = self.active.lock() {
            active.remove(&self.run_id);
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexModel {
    id: String,
    display_name: String,
    is_default: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCatalog {
    plan: String,
    models: Vec<CodexModel>,
    quota: Option<CodexQuota>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexQuota {
    limited: bool,
    resets_at: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexReply {
    thread_id: String,
    text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexDelta {
    run_id: String,
    delta: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAuthEvent {
    success: bool,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAuthStart {
    auth_url: String,
}

fn executable_path(raw: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw);
    if !path.is_absolute() || !path.is_file() {
        return Err("Sélectionnez le fichier codex.exe installé localement.".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|_| "Impossible de résoudre le chemin de Codex.".to_string())?;
    if !canonical
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("codex.exe"))
    {
        return Err("Seul l'exécutable codex.exe est accepté, sans script ni shell.".into());
    }
    // The app's isolated toolchain must not depend on Hermes' Node installation.
    if canonical
        .to_string_lossy()
        .to_ascii_lowercase()
        .replace('/', "\\")
        .contains("\\hermes\\")
    {
        return Err("Choisissez une installation de Codex indépendante de Hermes.".into());
    }
    // An IPC caller may control this path. Only launch a native executable
    // explicitly approved by deployment configuration or our isolated install.
    const LOCAL_CODEX: &str = r"E:\DevCaches\hebergtonserv-desktop\codex-cli\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe";
    let approved = std::env::var("HTS_CODEX_EXECUTABLE")
        .ok()
        .into_iter()
        .chain(std::iter::once(LOCAL_CODEX.to_string()))
        .any(|candidate| {
            Path::new(&candidate)
                .canonicalize()
                .is_ok_and(|path| path == canonical)
        });
    if !approved {
        return Err("Chemin Codex non autorisé. Utilisez l'installation validée ou configurez HTS_CODEX_EXECUTABLE côté système.".into());
    }
    Ok(canonical)
}

struct CodexProcess {
    _child: Child,
    input: ChildStdin,
    output: Lines<BufReader<ChildStdout>>,
    pending: VecDeque<Value>,
}

impl CodexProcess {
    async fn start(executable: &str, mcp_root: Option<&Path>) -> Result<Self, String> {
        let executable = executable_path(executable)?;
        // Never inherit the user's global Codex profile, tools, MCPs, hooks or sessions.
        // This dedicated CODEX_HOME owns only this app's ChatGPT authorization and threads.
        let home = dirs::data_local_dir()
            .ok_or("Impossible de trouver le dossier de données de Windows.")?
            .join(if env!("CARGO_PKG_VERSION").contains('-') {
                "HebergTonServDesktopPreview"
            } else {
                "HebergTonServDesktop"
            })
            .join("codex-isolated");
        tokio::fs::create_dir_all(&home)
            .await
            .map_err(|_| "Impossible de créer le profil Codex isolé.")?;
        let mut command = Command::new(executable);
        command.env("CODEX_HOME", home);
        // MCP is not connected unless the user explicitly authorized one folder.
        // Forbid global MCP servers even when the global Codex profile has them.
        let mcp_config = if let Some(root) = mcp_root {
            let node = std::env::var("HTS_NODE_EXECUTABLE")
                .unwrap_or_else(|_| r"C:\nvm4w\nodejs\node.exe".to_string());
            let server = std::env::var("HTS_MCP_SERVER_PATH").unwrap_or_else(|_| {
                r"E:\Projects\hebergtonserv-desktopcommander\dist\index.js".to_string()
            });
            let node = Path::new(&node)
                .canonicalize()
                .map_err(|_| "Node.js autorisé pour le MCP introuvable.")?;
            let server = Path::new(&server)
                .canonicalize()
                .map_err(|_| "Serveur MCP HébergTonServ introuvable.")?;
            if !node
                .file_name()
                .and_then(|v| v.to_str())
                .is_some_and(|v| v.eq_ignore_ascii_case("node.exe"))
                || !server
                    .file_name()
                    .and_then(|v| v.to_str())
                    .is_some_and(|v| v.eq_ignore_ascii_case("index.js"))
                || node
                    .to_string_lossy()
                    .to_ascii_lowercase()
                    .contains("hermes")
            {
                return Err("Binaire MCP non autorisé.".into());
            }
            let quote = |s: &str| {
                serde_json::to_string(s).map_err(|_| "Paramètre MCP invalide.".to_string())
            };
            format!(
                "mcp_servers={{hts_readonly={{command={},args=[{},\"--no-onboarding\"],env={{HTS_MCP_READ_ONLY=\"1\",HTS_MCP_ROOT={}}}}}}}",
                quote(&node.to_string_lossy())?,
                quote(&server.to_string_lossy())?,
                quote(&root.to_string_lossy())?
            )
        } else {
            "mcp_servers={}".to_string()
        };
        command.arg("-c").arg(mcp_config);
        command
            .arg("app-server")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true);
        let mut child = command
            .spawn()
            .map_err(|_| "Codex app-server n'a pas pu démarrer.".to_string())?;
        let input = child.stdin.take().ok_or("Entrée Codex indisponible.")?;
        let stdout = child.stdout.take().ok_or("Sortie Codex indisponible.")?;
        let mut process = Self {
            _child: child,
            input,
            output: BufReader::new(stdout).lines(),
            pending: VecDeque::new(),
        };
        process
            .rpc(
                1,
                "initialize",
                json!({
                    "clientInfo": {
                        "name": "hebergtonserv_desktop",
                        "title": "HébergTonServ Desktop",
                        "version": env!("CARGO_PKG_VERSION")
                    }
                }),
            )
            .await?;
        process
            .send(json!({"method":"initialized","params":{}}))
            .await?;
        // Fail closed: an agent from this UI may not inherit unmanaged MCP tools.
        let status = process
            .rpc(
                42,
                "mcpServerStatus/list",
                json!({"limit": 100, "detail":"toolsAndAuthOnly"}),
            )
            .await?;
        let servers = status["data"]
            .as_array()
            .ok_or("Catalogue MCP indisponible.")?;
        let allowed = match mcp_root {
            None => servers.is_empty(),
            Some(_) => servers.len() == 1 && servers[0]["name"].as_str() == Some("hts_readonly"),
        };
        if !allowed {
            return Err("Le profil Codex contient des outils MCP non approuvés. Réinitialisez le profil isolé.".into());
        }
        Ok(process)
    }

    async fn send(&mut self, message: Value) -> Result<(), String> {
        let line =
            serde_json::to_string(&message).map_err(|_| "Encodage RPC impossible.".to_string())?;
        self.input
            .write_all(line.as_bytes())
            .await
            .map_err(|_| "Connexion Codex interrompue.".to_string())?;
        self.input
            .write_all(b"\n")
            .await
            .map_err(|_| "Connexion Codex interrompue.".to_string())?;
        self.input
            .flush()
            .await
            .map_err(|_| "Connexion Codex interrompue.".to_string())
    }

    async fn next(&mut self) -> Result<Value, String> {
        loop {
            let line = self
                .output
                .next_line()
                .await
                .map_err(|_| "Lecture des événements Codex impossible.".to_string())?
                .ok_or("Codex s'est arrêté sans réponse.")?;
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                return Ok(value);
            }
        }
    }

    async fn rpc(&mut self, id: i64, method: &str, params: Value) -> Result<Value, String> {
        self.send(json!({"id":id,"method":method,"params":params}))
            .await?;
        tokio::time::timeout(Duration::from_secs(20), async {
            loop {
                let message = self.next().await?;
                if message["id"].as_i64() != Some(id) {
                    if message["method"].as_str().is_some_and(|m| {
                        m.starts_with("item/")
                            || m.starts_with("turn/")
                            || m == "account/login/completed"
                    }) && self.pending.len() < 256
                    {
                        self.pending.push_back(message);
                    }
                    continue;
                }
                if let Some(error) = message.get("error") {
                    return Err(error["message"]
                        .as_str()
                        .unwrap_or("Codex a refusé la requête.")
                        .to_string());
                }
                return message
                    .get("result")
                    .cloned()
                    .ok_or("Résultat Codex manquant.".to_string());
            }
        })
        .await
        .map_err(|_| "Codex ne répond pas (délai dépassé).".to_string())?
    }

    async fn require_chatgpt_plan(&mut self) -> Result<String, String> {
        let result = self
            .rpc(2, "account/read", json!({"refreshToken": false}))
            .await?;
        if result["account"]["type"].as_str() != Some("chatgpt") {
            return Err("Mode sans facturation API : connectez Codex avec votre compte ChatGPT, pas avec une clé API.".into());
        }
        Ok(result["account"]["planType"]
            .as_str()
            .unwrap_or("ChatGPT")
            .to_string())
    }
}

#[tauri::command]
pub fn local_codex_suggest_executable() -> Option<String> {
    let configured = std::env::var("HTS_CODEX_EXECUTABLE").ok();
    let local = r"E:\DevCaches\hebergtonserv-desktop\codex-cli\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe";
    configured
        .into_iter()
        .chain(std::iter::once(local.to_string()))
        .find(|candidate| executable_path(candidate).is_ok())
}

#[tauri::command]
pub async fn local_codex_models(executable: String) -> Result<CodexCatalog, String> {
    let mut server = CodexProcess::start(&executable, None).await?;
    let plan = server.require_chatgpt_plan().await?;
    let catalog = server
        .rpc(3, "model/list", json!({"limit":100,"includeHidden":false}))
        .await?;
    let models = catalog["data"]
        .as_array()
        .ok_or("Catalogue des modèles Codex indisponible.")?
        .iter()
        .filter_map(|entry| {
            Some(CodexModel {
                id: entry["model"]
                    .as_str()
                    .or_else(|| entry["id"].as_str())?
                    .to_string(),
                display_name: entry["displayName"].as_str()?.to_string(),
                is_default: entry["isDefault"].as_bool().unwrap_or(false),
            })
        })
        .collect();
    let quota = server
        .rpc(4, "account/rateLimits/read", json!({}))
        .await
        .ok()
        .map(|limits| {
            let bucket = &limits["rateLimits"];
            let primary_full = bucket["primary"]["usedPercent"]
                .as_f64()
                .is_some_and(|v| v >= 100.0);
            let secondary_full = bucket["secondary"]["usedPercent"]
                .as_f64()
                .is_some_and(|v| v >= 100.0);
            CodexQuota {
                limited: bucket["rateLimitReachedType"]
                    .as_str()
                    .is_some_and(|v| !v.is_empty())
                    || primary_full
                    || secondary_full,
                resets_at: if secondary_full {
                    bucket["secondary"]["resetsAt"].as_i64()
                } else if primary_full {
                    bucket["primary"]["resetsAt"].as_i64()
                } else {
                    None
                },
            }
        });
    Ok(CodexCatalog {
        plan,
        models,
        quota,
    })
}

#[tauri::command]
pub async fn local_codex_message(
    executable: String,
    thread_id: Option<String>,
    model: String,
    prompt: String,
    run_id: String,
    app: AppHandle,
    sessions: tauri::State<'_, CodexSessionState>,
) -> Result<CodexReply, String> {
    if uuid::Uuid::parse_str(&run_id).is_err() {
        return Err("Identifiant d'exécution invalide.".into());
    }
    if prompt.trim().is_empty() || prompt.len() > 8000 {
        return Err("Le message doit contenir entre 1 et 8 000 caractères.".into());
    }
    if model.trim().is_empty() || model.len() > 128 {
        return Err("Sélectionnez un modèle disponible.".into());
    }
    // Claim the run before any awaits; permission revocation must never race an
    // already-started Codex operation (including startup and model discovery).
    let (cancel_tx, mut cancel_rx) = watch::channel(false);
    {
        let mut active = sessions
            .active_turns
            .lock()
            .map_err(|_| "État des exécutions inaccessible.")?;
        if !active.is_empty() {
            return Err("Une réponse Codex est déjà en cours.".into());
        }
        active.insert(run_id.clone(), cancel_tx);
    }
    let _active_guard = ActiveRunGuard {
        active: Arc::clone(&sessions.active_turns),
        run_id: run_id.clone(),
    };
    let root = sessions
        .mcp_root
        .lock()
        .map_err(|_| "Autorisations MCP indisponibles.")?
        .clone();
    let mut server = CodexProcess::start(&executable, root.as_deref()).await?;
    server.require_chatgpt_plan().await?;
    // Never trust arbitrary model ids supplied by a WebView: check the live account catalog.
    let catalog = server
        .rpc(3, "model/list", json!({"limit":100,"includeHidden":false}))
        .await?;
    let allowed = catalog["data"].as_array().is_some_and(|entries| {
        entries.iter().any(|entry| {
            entry["model"].as_str() == Some(model.as_str())
                || entry["id"].as_str() == Some(model.as_str())
        })
    });
    if !allowed {
        return Err("Ce modèle n'est pas disponible pour le compte connecté.".into());
    }
    let thread = if let Some(id) = thread_id.filter(|id| !id.trim().is_empty()) {
        if id.len() > 128 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err("Identifiant de discussion invalide.".into());
        }
        if !sessions
            .issued_ids
            .lock()
            .map_err(|_| "État des sessions inaccessible.")?
            .contains(&id)
        {
            return Err("Cette discussion n'appartient pas à la session de l'application.".into());
        }
        let result = server
            .rpc(4, "thread/resume", json!({"threadId":id}))
            .await?;
        result["thread"]["id"]
            .as_str()
            .ok_or("Discussion Codex introuvable.".to_string())?
            .to_string()
    } else {
        // Isolated empty workspace: no implicit access to SSH keys or server credentials.
        let workdir = std::env::temp_dir().join("hebergtonserv-codex-readonly");
        tokio::fs::create_dir_all(&workdir)
            .await
            .map_err(|_| "Impossible de créer l'espace de travail isolé.".to_string())?;
        let result = server
            .rpc(
                4,
                "thread/start",
                json!({
                    "model":model,
                    "cwd":workdir.to_string_lossy(),
                    "sandbox":"read-only",
                    "approvalPolicy":"never",
                    "serviceName":"hebergtonserv_desktop"
                }),
            )
            .await?;
        result["thread"]["id"]
            .as_str()
            .ok_or("Création de la discussion refusée.".to_string())?
            .to_string()
    };
    sessions
        .issued_ids
        .lock()
        .map_err(|_| "État des sessions inaccessible.")?
        .insert(thread.clone());
    let turn_result = server
        .rpc(
            5,
            "turn/start",
            json!({
                "threadId": thread.clone(),
                "input": [{"type":"text","text":prompt}]
            }),
        )
        .await?;
    let turn_id = turn_result["turn"]["id"]
        .as_str()
        .ok_or("Identifiant du tour Codex manquant.")?
        .to_string();
    let mut streamed = String::new();
    let mut completed = String::new();
    let outcome = tokio::time::timeout(Duration::from_secs(150), async {
        loop {
            let event = if let Some(event) = server.pending.pop_front() {
                event
            } else {
                tokio::select! {
                    changed = cancel_rx.changed() => {
                        if changed.is_ok() && *cancel_rx.borrow_and_update() {
                            // Send the documented interrupt before dropping this isolated process.
                            let _ = server.send(json!({"id":99,"method":"turn/interrupt","params":{"threadId":thread,"turnId":turn_id}})).await;
                            return Err("Réponse Codex interrompue par l'utilisateur.".into());
                        }
                        continue;
                    }
                    next = server.next() => next?,
                }
            };
            match event["method"].as_str() {
                Some("item/agentMessage/delta") => {
                    if let Some(delta) = event["params"]["delta"].as_str()
                        && streamed.len() + delta.len() <= 250_000
                    {
                        streamed.push_str(delta);
                        let _ = app.emit_to("main", "hts:codex-delta", CodexDelta { run_id: run_id.clone(), delta: delta.to_string() });
                    }
                }
                Some("item/completed") => {
                    let item = &event["params"]["item"];
                    if item["type"].as_str() == Some("agentMessage")
                        && let Some(text) = item["text"].as_str()
                    {
                        completed = text.to_string();
                    }
                }
                Some("turn/completed") => {
                    if event["params"]["turn"]["status"].as_str() != Some("completed") {
                        return Err(event["params"]["turn"]["error"]["message"]
                            .as_str()
                            .unwrap_or("La réponse Codex n'a pas abouti.")
                            .to_string());
                    }
                    return Ok(());
                }
                _ => {}
            }
        }
    })
    .await
    .map_err(|_| "La réponse a dépassé le délai autorisé.".to_string())
    .and_then(|result| result);
    outcome?;
    let text = if completed.is_empty() {
        streamed
    } else {
        completed
    };
    Ok(CodexReply {
        thread_id: thread,
        text: if text.is_empty() {
            "Réponse terminée sans texte.".into()
        } else {
            text
        },
    })
}

fn validate_mcp_root(raw: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw);
    if raw.len() > 1024 || !path.is_absolute() || !path.is_dir() {
        return Err("Choisissez un dossier local existant et absolu.".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|_| "Impossible de vérifier le dossier choisi.".to_string())?;
    if canonical.parent().is_none()
        || dirs::home_dir()
            .and_then(|p| p.canonicalize().ok())
            .is_some_and(|home| home == canonical)
    {
        return Err(
            "Choisissez un dossier de projet, pas la racine du disque ou le profil Windows.".into(),
        );
    }
    Ok(canonical)
}

#[tauri::command]
pub fn local_codex_mcp_root(
    sessions: tauri::State<'_, CodexSessionState>,
) -> Result<Option<String>, String> {
    let root = sessions
        .mcp_root
        .lock()
        .map_err(|_| "Autorisations MCP indisponibles.")?;
    Ok(root.as_ref().map(|p| p.to_string_lossy().into_owned()))
}

/// An explicit per-application-session permission. Nothing is persisted.
/// The entire user-wide DesktopCommander config is deliberately NOT imported.
#[tauri::command]
pub fn local_codex_set_mcp_root(
    root: Option<String>,
    sessions: tauri::State<'_, CodexSessionState>,
) -> Result<Option<String>, String> {
    let authorized = match root {
        Some(path) => Some(validate_mcp_root(&path)?),
        None => None,
    };
    let active = sessions
        .active_turns
        .lock()
        .map_err(|_| "État des exécutions inaccessible.")?;
    if !active.is_empty() {
        return Err("Arrêtez la réponse en cours avant de modifier les autorisations MCP.".into());
    }
    let mut permitted = sessions
        .mcp_root
        .lock()
        .map_err(|_| "Autorisations MCP indisponibles.")?;
    *permitted = authorized.clone();
    drop(permitted);
    drop(active);
    // No existing thread can silently retain access granted before a permission change.
    sessions
        .issued_ids
        .lock()
        .map_err(|_| "État des discussions inaccessible.")?
        .clear();
    Ok(authorized.map(|p| p.to_string_lossy().into_owned()))
}

fn browser_login_url(raw: &str) -> Result<String, String> {
    let url = url::Url::parse(raw).map_err(|_| "Adresse de connexion Codex invalide.")?;
    if url.scheme() != "https"
        || !matches!(url.host_str(), Some("chatgpt.com" | "auth.openai.com"))
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Adresse de connexion hors des domaines officiels OpenAI.".into());
    }
    Ok(url.into())
}

/// Uses Codex's own official browser login. No website cookies are read by Tauri.
#[tauri::command]
pub async fn local_codex_login(
    executable: String,
    app: AppHandle,
    sessions: tauri::State<'_, CodexSessionState>,
) -> Result<CodexAuthStart, String> {
    if sessions.login_active.swap(true, Ordering::SeqCst) {
        return Err("Une connexion ChatGPT est déjà en cours.".into());
    }
    let flag = Arc::clone(&sessions.login_active);
    let result: Result<CodexAuthStart, String> = async {
        let mut server = CodexProcess::start(&executable, None).await?;
        let result = server
            .rpc(
                2,
                "account/login/start",
                json!({
                    "type": "chatgpt",
                    "useHostedLoginSuccessPage": true,
                    "appBrand": "chatgpt"
                }),
            )
            .await?;
        let auth_url = browser_login_url(
            result["authUrl"]
                .as_str()
                .ok_or("Lien de connexion Codex manquant.")?,
        )?;
        let login_id = result["loginId"]
            .as_str()
            .ok_or("Identifiant de connexion Codex manquant.")?
            .to_string();
        let running = Arc::clone(&flag);
        tauri::async_runtime::spawn(async move {
            let outcome = tokio::time::timeout(Duration::from_secs(600), async {
                loop {
                    let message = if let Some(event) = server.pending.pop_front() {
                        event
                    } else {
                        server.next().await?
                    };
                    if message["method"].as_str() == Some("account/login/completed")
                        && message["params"]["loginId"].as_str() == Some(login_id.as_str())
                    {
                        if message["params"]["success"].as_bool() == Some(true) {
                            return Ok(());
                        }
                        return Err(message["params"]["error"]
                            .as_str()
                            .unwrap_or("Connexion ChatGPT refusée.")
                            .to_string());
                    }
                }
            })
            .await;
            running.store(false, Ordering::SeqCst);
            let message = match outcome {
                Ok(Ok(())) => CodexAuthEvent {
                    success: true,
                    message: "Connexion ChatGPT réussie. Rechargez les modèles.".into(),
                },
                Ok(Err(message)) => CodexAuthEvent {
                    success: false,
                    message,
                },
                Err(_) => CodexAuthEvent {
                    success: false,
                    message: "Délai de connexion ChatGPT dépassé.".into(),
                },
            };
            let _ = app.emit_to("main", "hts:codex-auth", message);
        });
        Ok(CodexAuthStart { auth_url })
    }
    .await;
    if result.is_err() {
        flag.store(false, Ordering::SeqCst);
    }
    result
}

#[tauri::command]
pub fn local_codex_cancel_run(
    run_id: String,
    sessions: tauri::State<'_, CodexSessionState>,
) -> Result<bool, String> {
    let active = sessions
        .active_turns
        .lock()
        .map_err(|_| "État des exécutions inaccessible.")?;
    Ok(active
        .get(&run_id)
        .is_some_and(|sender| sender.send(true).is_ok()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_missing_executable() {
        assert!(executable_path("codex.exe").is_err());
        assert!(executable_path("C:\\invalid\\codex.exe").is_err());
    }
    #[test]
    fn validates_browser_login_urls() {
        assert!(browser_login_url("https://chatgpt.com/auth/test?state=123").is_ok());
        assert!(browser_login_url("https://auth.openai.com/login").is_ok());
        assert!(browser_login_url("http://chatgpt.com/auth").is_err());
        assert!(browser_login_url("https://chatgpt.com.evil.test/login").is_err());
        assert!(browser_login_url("https://user:password@chatgpt.com/login").is_err());
        assert!(browser_login_url("file:///C:/Windows/System32/cmd.exe").is_err());
    }

    #[test]
    fn mcp_root_requires_an_existing_project_folder() {
        let folder = tempfile::tempdir().expect("create temporary project");
        assert!(validate_mcp_root(folder.path().to_str().unwrap()).is_ok());
        assert!(validate_mcp_root("missing/relative/folder").is_err());
        assert!(validate_mcp_root(r"C:\").is_err());
    }
}
