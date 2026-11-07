//! Local Codex app-server bridge. No ChatGPT web cookies or private backend APIs.
//! Only an explicitly selected Codex executable is launched; never through a shell.
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

#[derive(Default)]
pub struct CodexSessionState {
    issued_ids: Mutex<HashSet<String>>,
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
    async fn start(executable: &str) -> Result<Self, String> {
        let executable = executable_path(executable)?;
        let mut command = Command::new(executable);
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
                    if message["method"]
                        .as_str()
                        .is_some_and(|m| m.starts_with("item/") || m.starts_with("turn/"))
                        && self.pending.len() < 256
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
    let mut server = CodexProcess::start(&executable).await?;
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
    sessions: tauri::State<'_, CodexSessionState>,
) -> Result<CodexReply, String> {
    if prompt.trim().is_empty() || prompt.len() > 8000 {
        return Err("Le message doit contenir entre 1 et 8 000 caractères.".into());
    }
    if model.trim().is_empty() || model.len() > 128 {
        return Err("Sélectionnez un modèle disponible.".into());
    }
    let mut server = CodexProcess::start(&executable).await?;
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
    server
        .rpc(
            5,
            "turn/start",
            json!({
                "threadId": thread,
                "input": [{"type":"text","text":prompt}]
            }),
        )
        .await?;
    let mut streamed = String::new();
    let mut completed = String::new();
    tokio::time::timeout(Duration::from_secs(150), async {
        loop {
            let event = if let Some(event) = server.pending.pop_front() {
                event
            } else {
                server.next().await?
            };
            match event["method"].as_str() {
                Some("item/agentMessage/delta") => {
                    if let Some(delta) = event["params"]["delta"].as_str()
                        && streamed.len() + delta.len() <= 250_000
                    {
                        streamed.push_str(delta);
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
    .map_err(|_| "La réponse a dépassé le délai autorisé.".to_string())??;
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_missing_executable() {
        assert!(executable_path("codex.exe").is_err());
        assert!(executable_path("C:\\invalid\\codex.exe").is_err());
    }
}
