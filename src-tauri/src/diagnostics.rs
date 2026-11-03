use chrono::Utc;
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

const CAPACITY: usize = 1500;
const MAX_API_DIAGNOSTIC_BYTES: usize = 12 * 1024;
const MAX_DIAGNOSTIC_DEPTH: usize = 12;

#[derive(Clone, Serialize)]
pub struct DiagnosticEntry {
    pub timestamp: String,
    pub level: &'static str,
    pub operation: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

static JOURNAL: OnceLock<Mutex<VecDeque<DiagnosticEntry>>> = OnceLock::new();

fn journal() -> &'static Mutex<VecDeque<DiagnosticEntry>> {
    JOURNAL.get_or_init(|| Mutex::new(VecDeque::with_capacity(CAPACITY)))
}

/// Only trusted, constant messages and machine-readable error codes.
/// Never pass URLs, response bodies, headers, server names or credentials here.
pub fn record(level: &'static str, operation: &'static str, code: &str, message: &'static str) {
    let allowed = matches!(level, "info" | "warning" | "error");
    if !allowed
        || code.len() > 64
        || !code
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return;
    }
    if let Ok(mut entries) = journal().lock() {
        if entries.len() == CAPACITY {
            entries.pop_front();
        }
        entries.push_back(DiagnosticEntry {
            timestamp: Utc::now().to_rfc3339(),
            level,
            operation: operation.to_string(),
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        });
    }
}

/// Aggregate counts only: no server identity or response data leaves this function.
pub fn record_batch_summary(total: usize, failures: usize) {
    if total > 16 || failures > total {
        return;
    }
    let message = format!(
        "Lot de ressources : {} réussies, {} échecs sur {}.",
        total - failures,
        failures,
        total
    );
    if let Ok(mut entries) = journal().lock() {
        if entries.len() == CAPACITY {
            entries.pop_front();
        }
        entries.push_back(DiagnosticEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: if failures == 0 { "info" } else { "warning" },
            operation: "panel_resources".into(),
            code: "batch_summary".into(),
            message,
            details: None,
        });
    }
}

/// The webview can emit only fixed console lifecycle events; no arbitrary
/// strings, server output, WebSocket tokens or URLs are accepted.
#[tauri::command]
pub fn record_console_connection_event(event: String) {
    let (level, code, message) = match event.as_str() {
        "ws_connected" => ("info", "ws_connected", "Connexion Wings établie"),
        "ws_authenticated" => ("info", "ws_authenticated", "Authentification Wings réussie"),
        "ws_closed" => ("warning", "ws_closed", "Connexion Wings fermée"),
        "ws_connect_failed" => (
            "error",
            "ws_connect_failed",
            "Impossible d'ouvrir le WebSocket Wings",
        ),
        "ws_auth_failed" => ("error", "ws_auth_failed", "Authentification Wings refusée"),
        "ws_expired" => ("warning", "ws_expired", "Jeton Wings expiré"),
        "ws_send_failed" => ("warning", "ws_send_failed", "Envoi WebSocket échoué"),
        _ => return,
    };
    record(level, "console_websocket", code, message);
}

/// A deliberately strict vocabulary: no untrusted text, arguments, credentials,
/// filesystem paths, URLs, server identifiers or exception stacks are recorded.
#[tauri::command]
pub fn record_app_event(source: String, code: String) {
    let (level, operation, event, description) = match (source.as_str(), code.as_str()) {
        ("lifecycle", "app_started") => ("info", "lifecycle", "app_started", "Interface démarrée"),
        ("lifecycle", "close_requested") => {
            ("info", "lifecycle", "close_requested", "Fermeture demandée")
        }
        ("lifecycle", "window_ready") => (
            "info",
            "lifecycle",
            "window_ready",
            "Fenêtre principale prête",
        ),
        ("navigation", "route_changed") => (
            "info",
            "navigation",
            "route_changed",
            "Navigation vers une page",
        ),
        ("frontend", "unhandled_error") => (
            "error",
            "frontend",
            "unhandled_error",
            "Erreur JavaScript non gérée",
        ),
        ("frontend", "unhandled_rejection") => (
            "error",
            "frontend",
            "unhandled_rejection",
            "Promesse JavaScript rejetée sans gestion",
        ),
        ("frontend", "console_error") => (
            "warning",
            "frontend",
            "console_error",
            "Erreur rapportée dans la console JavaScript",
        ),
        ("auth", "session_authenticated") => (
            "info",
            "auth",
            "session_authenticated",
            "Authentification de l'application réussie",
        ),
        ("help", "changelog_opened") => (
            "info",
            "help",
            "changelog_opened",
            "Historique des versions ouvert",
        ),
        ("help", "changelog_loaded") => {
            ("info", "help", "changelog_loaded", "Versions GitHub reçues")
        }
        ("help", "changelog_failed") => (
            "warning",
            "help",
            "changelog_failed",
            "Chargement des versions GitHub impossible",
        ),
        ("help", "shortcuts_opened") => (
            "info",
            "help",
            "shortcuts_opened",
            "Raccourcis clavier affichés",
        ),
        ("help", "diagnostics_opened") => (
            "info",
            "help",
            "diagnostics_opened",
            "Journal de diagnostic ouvert",
        ),
        ("windows", "task_manager_opened") => (
            "info",
            "windows",
            "task_manager_opened",
            "Gestionnaire de tâches ouvert",
        ),
        ("windows", "task_snapshot_failed") => (
            "warning",
            "windows",
            "task_snapshot_failed",
            "Lecture des processus indisponible",
        ),
        _ => return,
    };
    record(level, operation, event, description);
}

/// Timing and outcome only. This allowlist prevents untrusted invocations
/// (including deliberately crafted command names) from encoding secrets.
#[tauri::command]
pub fn record_command_event(operation: String, outcome: String, duration_ms: u32) {
    let accepted = matches!(
        operation.as_str(),
        "get_git_tools"
            | "inspect_git_repository"
            | "get_github_activity"
            | "mutate_git_repository"
            | "toggle_app_window_maximize"
            | "list_ssh_keys"
            | "generate_ssh_key"
            | "import_public_key"
            | "read_ssh_public_key"
            | "delete_ssh_key"
            | "list_ssh_trash"
            | "test_ssh_connection"
            | "open_ssh_connection"
            | "scan_host_key"
            | "append_host_key"
            | "read_ssh_config"
            | "upsert_ssh_config"
            | "delete_ssh_config"
            | "import_ssh_config_profiles"
            | "agent_status"
            | "agent_identities"
            | "agent_add_identity"
            | "agent_remove_identity"
            | "list_panels"
            | "login_wisp"
            | "save_panel"
            | "delete_panel"
            | "check_panel"
            | "get_panel_account"
            | "list_panel_servers"
            | "get_panel_resources_batch"
            | "get_panel_server_resources"
            | "set_panel_token"
            | "panel_token_configured"
            | "create_panel_api_key"
            | "create_panel_ssh_key"
            | "revoke_panel_api_key"
            | "delete_panel_ssh_key"
            | "list_ssh_profiles"
            | "save_ssh_profile"
            | "delete_ssh_profile"
            | "get_settings"
            | "update_settings"
            | "enable_autostart"
            | "disable_autostart"
            | "get_security_state"
    );
    if !accepted || duration_ms > 60_000 || !matches!(outcome.as_str(), "ok" | "error") {
        return;
    }
    let (level, code) = if outcome == "error" {
        ("warning", "command_error")
    } else if duration_ms >= 1500 {
        ("warning", "command_slow")
    } else {
        ("info", "command_ok")
    };
    let entry = DiagnosticEntry {
        timestamp: Utc::now().to_rfc3339(),
        level,
        operation: operation.clone(),
        code: code.to_owned(),
        message: format!(
            "Commande Tauri {} ({} ms) ; arguments et réponse exclus.",
            outcome, duration_ms
        ),
        details: None,
    };
    if let Ok(mut events) = journal().lock() {
        if events.len() == CAPACITY {
            events.pop_front();
        }
        events.push_back(entry);
    }
}

fn sensitive_diagnostic_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    [
        "token",
        "password",
        "secret",
        "authorization",
        "cookie",
        "credential",
        "api_key",
        "private_key",
        "url",
        "address",
        "hostname",
        "host",
        "ip",
        "path",
    ]
    .iter()
    .any(|part| key.contains(part))
        || matches!(
            key.as_str(),
            "id" | "uuid"
                | "identifier"
                | "email"
                | "username"
                | "first_name"
                | "last_name"
                | "name"
                | "user"
                | "owner"
                | "key"
                | "jdbc_connection_string"
        )
        || key.ends_with("_id")
        || key.ends_with("_uuid")
        || key.ends_with("_name")
        || key.ends_with("_key")
}

fn safe_diagnostic_string_key(key: &str) -> bool {
    matches!(
        key.to_ascii_lowercase().as_str(),
        "status" | "state" | "current_state" | "type" | "method" | "version" | "action"
    )
}

fn redact_diagnostic_json(value: &Value, key: Option<&str>, depth: usize) -> Value {
    if depth >= MAX_DIAGNOSTIC_DEPTH {
        return Value::String("<depth limit>".into());
    }
    if key.is_some_and(sensitive_diagnostic_key) {
        return Value::String("<redacted>".into());
    }
    match value {
        Value::Object(object) => {
            let mut redacted = Map::new();
            for (child_key, child_value) in object {
                redacted.insert(
                    child_key.clone(),
                    redact_diagnostic_json(child_value, Some(child_key), depth + 1),
                );
            }
            Value::Object(redacted)
        }
        Value::Array(items) => Value::Array(
            items
                .iter()
                .take(50)
                .map(|item| redact_diagnostic_json(item, key, depth + 1))
                .collect(),
        ),
        Value::String(text)
            if key.is_some_and(safe_diagnostic_string_key)
                && text.len() <= 24
                && text.chars().all(|character| {
                    character.is_ascii_alphanumeric() || "_.-".contains(character)
                }) =>
        {
            Value::String(text.chars().take(80).collect())
        }
        Value::String(_) => Value::String("<string redacted>".into()),
        other => other.clone(),
    }
}

fn bounded_api_details(
    method: &str,
    status: Option<u16>,
    duration_ms: u64,
    content_type: Option<&str>,
    response: Option<&Value>,
) -> Value {
    let mut details = serde_json::json!({
        "request": { "method": method },
        "duration_ms": duration_ms,
    });
    if let Some(status) = status {
        details["response"]["status"] = serde_json::json!(status);
    }
    if let Some(content_type) = content_type {
        // Content-Type is a protocol value. Drop parameters and cap its length.
        let media_type = content_type.split(';').next().unwrap_or_default().trim();
        details["response"]["content_type"] = Value::String(media_type.chars().take(100).collect());
    }
    if let Some(response) = response {
        details["response"]["json"] = redact_diagnostic_json(response, None, 0);
        let encoded = serde_json::to_vec(&details).unwrap_or_default();
        if encoded.len() > MAX_API_DIAGNOSTIC_BYTES {
            details["response"]["json"] = serde_json::json!({
                "_diagnostic": "response_truncated",
                "sanitized_bytes": encoded.len(),
                "limit_bytes": MAX_API_DIAGNOSTIC_BYTES,
            });
        }
    }
    details
}

/// Keep useful API response structure in the volatile journal while redacting
/// credentials, personal identifiers, names, network addresses, and paths.
pub struct ApiExchange<'a> {
    pub method: &'a str,
    pub status: Option<u16>,
    pub duration_ms: u64,
    pub content_type: Option<&'a str>,
    pub response: Option<&'a Value>,
}

pub fn record_api_exchange(
    level: &'static str,
    operation: &'static str,
    code: &str,
    message: &'static str,
    exchange: ApiExchange<'_>,
) {
    if !matches!(level, "info" | "warning" | "error")
        || exchange.duration_ms > 60_000
        || code.len() > 64
        || !code
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return;
    }
    let entry = DiagnosticEntry {
        timestamp: Utc::now().to_rfc3339(),
        level,
        operation: operation.to_string(),
        code: code.to_owned(),
        message: message.to_owned(),
        details: Some(bounded_api_details(
            exchange.method,
            exchange.status,
            exchange.duration_ms,
            exchange.content_type,
            exchange.response,
        )),
    };
    if let Ok(mut entries) = journal().lock() {
        if entries.len() == CAPACITY {
            entries.pop_front();
        }
        entries.push_back(entry);
    }
}

#[tauri::command]
pub fn list_panel_diagnostics() -> Vec<DiagnosticEntry> {
    journal()
        .lock()
        .map(|v| v.iter().cloned().collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn clear_panel_diagnostics() {
    if let Ok(mut entries) = journal().lock() {
        entries.clear();
    }
}

fn formatted_log() -> String {
    let mut contents =
        String::from("# HébergTonServ Desktop — diagnostic API (sans données sensibles)\n");
    for entry in list_panel_diagnostics() {
        contents.push_str(&format!(
            "{} [{}] {} {}: {}\n",
            entry.timestamp, entry.level, entry.operation, entry.code, entry.message
        ));
        if let Some(details) = entry.details {
            contents.push_str("  Détails API expurgés :\n");
            contents
                .push_str(&serde_json::to_string_pretty(&details).unwrap_or_else(|_| "{}".into()));
            contents.push('\n');
        }
        let hint = match entry.code.as_str() {
            "api_validation_error" => {
                "HTTP 400/422 : paramètres invalides ou état incompatible, vérifier la suspension et les droits."
            }
            "api_auth_failed" => "HTTP 401 : authentification Client API refusée.",
            "api_forbidden" => "HTTP 403 : autorisation Client API insuffisante.",
            "api_not_found" => "HTTP 404 : serveur ou endpoint inconnu.",
            "api_rate_limited" => "HTTP 429 : limitation de fréquence.",
            "batch_partial" => "Une ou plusieurs requêtes du lot ont échoué.",
            _ => "Consulter les permissions, le statut et les journaux du panel.",
        };
        contents.push_str(&format!("  Diagnostic : {hint}\n"));
    }
    contents
}

#[tauri::command]
pub async fn export_panel_diagnostics(path: String) -> Result<(), String> {
    let output = std::path::Path::new(&path);
    if path.len() > 4096
        || !matches!(
            output.extension().and_then(|x| x.to_str()),
            Some("txt" | "log")
        )
    {
        return Err("Choisissez un fichier .txt ou .log.".to_string());
    }
    if !output.is_absolute() {
        return Err("Un chemin absolu est nécessaire.".to_string());
    }
    tokio::fs::write(output, formatted_log())
        .await
        .map_err(|_| "Export impossible. Vérifiez les autorisations du dossier.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // These tests mutate a process-global journal. Their execution must be
    // serialized; Rust's test harness executes independent tests in parallel.
    static TEST_JOURNAL_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn console_events_are_whitelisted_without_untrusted_data() {
        let _guard = TEST_JOURNAL_LOCK
            .lock()
            .expect("test journal lock poisoned");
        clear_panel_diagnostics();
        record_console_connection_event("ws_connected".into());
        record_console_connection_event("token=do-not-record".into());
        let events = list_panel_diagnostics();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].operation, "console_websocket");
        assert_eq!(events[0].code, "ws_connected");
        clear_panel_diagnostics();
    }

    #[test]
    fn ignores_untrusted_codes_and_bounds_history() {
        let _guard = TEST_JOURNAL_LOCK
            .lock()
            .expect("test journal lock poisoned");
        clear_panel_diagnostics();
        record("error", "resource", "token=secret", "Échec");
        assert!(list_panel_diagnostics().is_empty());
        for _ in 0..(CAPACITY + 10) {
            record("info", "resource", "ok", "Sans données sensibles");
        }
        assert_eq!(list_panel_diagnostics().len(), CAPACITY);
        clear_panel_diagnostics();
    }

    #[test]
    fn api_response_details_keep_json_shape_and_redact_private_fields() {
        let _guard = TEST_JOURNAL_LOCK
            .lock()
            .expect("test journal lock poisoned");
        clear_panel_diagnostics();
        let response = serde_json::json!({
            "data": [{
                "id": "private-server-id",
                "attributes": {
                    "name": "private server name",
                    "state": "running",
                    "code": "secret-code-that-must-be-hidden",
                    "email": "person@example.test",
                    "api_key": "secret-token-value",
                    "database": { "password": "db-password", "host": "10.0.0.1" },
                    "limits": { "memory": 2048, "cpu": 100 }
                }
            }],
            "meta": { "pagination": { "current_page": 1, "total_pages": 2 } }
        });
        record_api_exchange(
            "info",
            "wisp_resources",
            "api_ok",
            "Réponse HTTP réussie",
            ApiExchange {
                method: "GET",
                status: Some(200),
                duration_ms: 32,
                content_type: Some("application/json; charset=utf-8"),
                response: Some(&response),
            },
        );
        let entries = list_panel_diagnostics();
        let details = entries[0].details.as_ref().unwrap();
        let encoded = serde_json::to_string(details).unwrap();
        assert!(encoded.contains("running"));
        assert!(encoded.contains("current_page"));
        assert!(encoded.contains("2048"));
        assert!(encoded.contains("<string redacted>"));
        for private in [
            "private-server-id",
            "private server name",
            "secret-code-that-must-be-hidden",
            "person@example.test",
            "secret-token-value",
            "db-password",
            "10.0.0.1",
        ] {
            assert!(!encoded.contains(private), "leaked {private}");
        }
        clear_panel_diagnostics();
    }

    #[test]
    fn api_response_details_are_bounded() {
        let metrics = (0..50)
            .map(|_| {
                let values = (0..40)
                    .map(|index| (format!("metric_{index}"), serde_json::json!(index)))
                    .collect::<Map<_, _>>();
                Value::Object(values)
            })
            .collect::<Vec<_>>();
        let response = serde_json::json!({"metrics": metrics});
        let details = bounded_api_details("GET", Some(200), 1, None, Some(&response));
        assert!(serde_json::to_vec(&details).unwrap().len() < 1024);
        assert_eq!(
            details["response"]["json"]["_diagnostic"],
            "response_truncated"
        );
    }
}
