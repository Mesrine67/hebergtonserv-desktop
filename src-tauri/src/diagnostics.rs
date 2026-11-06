use chrono::Utc;
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

const CAPACITY: usize = 1500;
const MAX_API_DIAGNOSTIC_BYTES: usize = 32 * 1024;
const MAX_DIAGNOSTIC_DEPTH: usize = 12;

#[derive(Clone, Serialize)]
pub struct DiagnosticEntry {
    pub event_id: u64,
    pub schema_version: u8,
    pub timestamp: String,
    pub level: &'static str,
    pub operation: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

static JOURNAL: OnceLock<Mutex<VecDeque<DiagnosticEntry>>> = OnceLock::new();
static NEXT_EVENT_ID: AtomicU64 = AtomicU64::new(1);

fn journal() -> &'static Mutex<VecDeque<DiagnosticEntry>> {
    JOURNAL.get_or_init(|| Mutex::new(VecDeque::with_capacity(CAPACITY)))
}

/// Only trusted, constant messages and machine-readable error codes.
/// Never pass URLs, response bodies, headers, server names or credentials here.
pub fn record(level: &'static str, operation: &'static str, code: &str, message: &'static str) {
    record_detailed(level, operation, code, message, None);
}

fn record_detailed(
    level: &'static str,
    operation: &'static str,
    code: &str,
    message: &'static str,
    details: Option<Value>,
) {
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
        entries.push_back(new_entry(level, operation, code, message, details));
    }
}

fn new_entry(
    level: &'static str,
    operation: &str,
    code: &str,
    message: &str,
    details: Option<Value>,
) -> DiagnosticEntry {
    DiagnosticEntry {
        event_id: NEXT_EVENT_ID.fetch_add(1, Ordering::Relaxed),
        schema_version: 1,
        timestamp: Utc::now().to_rfc3339(),
        level,
        operation: operation.to_string(),
        code: code.to_string(),
        message: message.to_string(),
        details,
    }
}

fn push_entry(entry: DiagnosticEntry) {
    if let Ok(mut entries) = journal().lock() {
        if entries.len() == CAPACITY {
            entries.pop_front();
        }
        entries.push_back(entry);
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
        entries.push_back(new_entry(
            if failures == 0 { "info" } else { "warning" },
            "panel_resources",
            "batch_summary",
            &message,
            Some(serde_json::json!({
                "requested": total,
                "succeeded": total - failures,
                "failed": failures,
                "identifiers_included": false,
            })),
        ));
    }
}

/// The webview can emit only fixed console lifecycle events; no arbitrary
/// strings, server output, WebSocket tokens or URLs are accepted.
#[tauri::command]
pub fn record_console_connection_event(
    event: String,
    provider: Option<String>,
    count: Option<u32>,
) {
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
        "ws_status_received" => (
            "info",
            "ws_status_received",
            "État du serveur reçu par Wings",
        ),
        "ws_logs_requested" => ("info", "ws_logs_requested", "Flux de logs demandé à Wings"),
        "ws_stats_requested" => (
            "info",
            "ws_stats_requested",
            "Flux de statistiques demandé à Wings",
        ),
        "ws_command_sent" => ("info", "ws_command_sent", "Commande envoyée à Wings"),
        "ws_output_batch" => ("info", "ws_output_batch", "Sorties console reçues"),
        _ => return,
    };
    let count = count.filter(|count| *count > 0 && *count <= 10_000);
    let provider = match provider.as_deref().map(str::to_ascii_lowercase).as_deref() {
        Some("wisp") => "wisp",
        Some("pterodactyl") => "pterodactyl",
        _ => "unknown",
    };
    let details = match event.as_str() {
        "ws_connected" => serde_json::json!({
            "transport": "websocket",
            "endpoint_security": "wss_tls",
            "phase": "connection_open",
            "provider": provider,
            "authentication": "pending",
            "url_logged": false,
        }),
        "ws_authenticated" => serde_json::json!({
            "transport": "websocket",
            "endpoint_security": "wss_tls",
            "phase": "authentication",
            "provider": provider,
            "panel_event": "auth success",
            "outcome": "success",
            "credential_source": "ephemeral_client_api_token",
            "credential_saved_or_logged": false,
            "initial_streams_requested": ["send logs", "send stats"],
        }),
        "ws_closed" => serde_json::json!({
            "transport": "websocket",
            "phase": "connection_closed",
            "provider": provider,
            "close_code_or_reason": "not_exposed_by_client",
        }),
        "ws_connect_failed" => serde_json::json!({
            "transport": "websocket",
            "endpoint_security": "wss_tls",
            "phase": "handshake",
            "provider": provider,
            "outcome": "failed",
            "url_and_error_text_logged": false,
        }),
        "ws_auth_failed" => serde_json::json!({
            "transport": "websocket",
            "phase": "authentication",
            "provider": provider,
            "outcome": "rejected",
            "credential_source": "ephemeral_client_api_token",
            "credential_and_server_output_logged": false,
        }),
        "ws_expired" => serde_json::json!({
            "transport": "websocket",
            "phase": "token_lifecycle",
            "provider": provider,
            "outcome": "expired_or_expiring",
            "reconnect_requested": true,
            "token_logged": false,
        }),
        "ws_send_failed" => serde_json::json!({
            "transport": "websocket",
            "phase": "client_send",
            "provider": provider,
            "outcome": "failed",
            "command_text_logged": false,
        }),
        "ws_status_received" => serde_json::json!({
            "transport": "websocket",
            "phase": "server_status",
            "provider": provider,
            "server_status_value_logged": false,
        }),
        "ws_logs_requested" => serde_json::json!({
            "transport": "websocket",
            "phase": "initial_stream",
            "provider": provider,
            "stream": "send logs",
        }),
        "ws_stats_requested" => serde_json::json!({
            "transport": "websocket",
            "phase": "initial_stream",
            "provider": provider,
            "stream": "send stats",
        }),
        "ws_command_sent" => serde_json::json!({
            "transport": "websocket",
            "phase": "console_command",
            "provider": provider,
            "command_text_logged": false,
        }),
        "ws_output_batch" => serde_json::json!({
            "transport": "websocket",
            "phase": "console_output",
            "provider": provider,
            "output_text_logged": false,
            "batch_entries": count.unwrap_or(0),
        }),
        _ => return,
    };
    record_detailed(level, "console_websocket", code, message, Some(details));
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
    record_detailed(
        level,
        operation,
        event,
        description,
        Some(serde_json::json!({
            "source": operation,
            "event": event,
            "arguments_recorded": false,
            "personal_data_recorded": false,
        })),
    );
}

/// Timing and outcome only. This allowlist prevents untrusted invocations
/// (including deliberately crafted command names) from encoding secrets.
#[tauri::command]
pub fn record_command_event(
    operation: String,
    outcome: String,
    duration_ms: u32,
    request_json: Option<Value>,
    response_json: Option<Value>,
) {
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
            | "list_panel_server_files"
            | "read_panel_server_file"
            | "write_panel_server_file"
            | "list_panel_server_databases"
            | "send_panel_server_power_signal"
            | "get_panel_console_credentials"
            | "open_detached_console_window"
            | "export_console_logs"
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
    let mut details = serde_json::json!({
        "outcome": outcome,
        "duration_ms": duration_ms,
        "slow_threshold_ms": 1500,
        "request": { "json": request_json.as_ref().map(|value| redact_diagnostic_json(value, None, 0)) },
        "response": { "json": response_json.as_ref().map(|value| redact_diagnostic_json(value, None, 0)) },
    });
    let encoded = serde_json::to_vec(&details).unwrap_or_default();
    if encoded.len() > MAX_API_DIAGNOSTIC_BYTES {
        details["response"]["json"] = serde_json::json!({
            "_diagnostic": "response_truncated",
            "sanitized_bytes": encoded.len(),
            "limit_bytes": MAX_API_DIAGNOSTIC_BYTES,
        });
    }
    let entry = new_entry(
        level,
        &operation,
        code,
        &format!(
            "Commande Tauri {} ({} ms) ; arguments et réponse exclus.",
            outcome, duration_ms
        ),
        Some(details),
    );
    push_entry(entry);
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
        "status" | "state" | "current_state" | "type" | "method" | "version" | "action" | "signal"
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
    operation: &str,
    method: &str,
    status: Option<u16>,
    duration_ms: u64,
    content_type: Option<&str>,
    request: Option<&Value>,
    response: Option<&Value>,
) -> Value {
    let mut details = serde_json::json!({
        "request": { "operation": operation, "method": method },
        "duration_ms": duration_ms,
    });
    if let Some(request) = request {
        details["request"]["json"] = redact_diagnostic_json(request, None, 0);
    }
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
    pub request: Option<&'a Value>,
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
    let entry = new_entry(
        level,
        operation,
        code,
        message,
        Some(bounded_api_details(
            operation,
            exchange.method,
            exchange.status,
            exchange.duration_ms,
            exchange.content_type,
            exchange.request,
            exchange.response,
        )),
    );
    push_entry(entry);
}

pub fn record_task_snapshot(process_count: usize, total_memory_kib: u64) {
    if process_count > 100_000 {
        return;
    }
    push_entry(new_entry(
        "info",
        "windows_tasks",
        "snapshot_ok",
        "Liste des processus Windows récupérée",
        Some(serde_json::json!({
            "process_count": process_count,
            "total_memory_kib": total_memory_kib,
            "process_names_or_pids_recorded": false,
            "source": "tasklist.exe",
        })),
    ));
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

#[tauri::command]
pub async fn export_panel_diagnostics(path: String, format: String) -> Result<(), String> {
    let output = std::path::Path::new(&path);
    if path.len() > 4096
        || !matches!(
            output.extension().and_then(|x| x.to_str()),
            Some("txt" | "log" | "json")
        )
    {
        return Err("Choisissez un fichier .txt, .log ou .json.".to_string());
    }
    if !output.is_absolute() {
        return Err("Un chemin absolu est nécessaire.".to_string());
    }
    if !matches!(format.as_str(), "json" | "txt") {
        return Err("Format d’export non pris en charge.".to_string());
    }
    let contents = if format == "json" {
        let entries = list_panel_diagnostics();
        serde_json::to_vec_pretty(&serde_json::json!({
            "schema_version": 1,
            "application": "HébergTonServ Desktop",
            "version": env!("CARGO_PKG_VERSION"),
            "exported_at": Utc::now().to_rfc3339(),
            "entry_count": entries.len(),
            "events": entries,
        }))
        .map_err(|_| "Sérialisation JSON impossible.".to_string())?
    } else {
        let mut text = String::from("# HébergTonServ Desktop — journal global schema v1\n");
        for entry in list_panel_diagnostics() {
            text.push_str(&format!(
                "{} [{}] #{} schema={} {} {}: {}\n",
                entry.timestamp,
                entry.level,
                entry.event_id,
                entry.schema_version,
                entry.operation,
                entry.code,
                entry.message
            ));
            if let Some(details) = entry.details {
                text.push_str("  Détails expurgés :\n");
                text.push_str(
                    &serde_json::to_string_pretty(&details).unwrap_or_else(|_| "{}".into()),
                );
                text.push('\n');
            }
        }
        text.into_bytes()
    };
    tokio::fs::write(output, contents)
        .await
        .map_err(|_| "Export impossible. Vérifiez les autorisations du dossier.".to_string())
}

#[tauri::command]
pub fn export_console_logs(path: String, contents: String) -> Result<(), String> {
    if contents.len() > 16 * 1024 * 1024 {
        return Err("La sortie de console dépasse la limite d’export de 16 Mio.".into());
    }
    let output = std::path::Path::new(&path);
    if !matches!(
        output.extension().and_then(|extension| extension.to_str()),
        Some("log" | "txt")
    ) {
        return Err("Choisissez un fichier .log ou .txt.".into());
    }
    std::fs::write(output, contents)
        .map_err(|_| "Impossible d’enregistrer le fichier de logs.".to_string())
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
        record_console_connection_event("ws_connected".into(), Some("wisp".into()), None);
        record_console_connection_event("token=do-not-record".into(), None, None);
        let events = list_panel_diagnostics();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].operation, "console_websocket");
        assert_eq!(events[0].code, "ws_connected");
        clear_panel_diagnostics();
    }

    #[test]
    fn command_json_details_keep_shape_and_redact_sensitive_fields() {
        let _guard = TEST_JOURNAL_LOCK
            .lock()
            .expect("test journal lock poisoned");
        clear_panel_diagnostics();
        record_command_event(
            "list_panel_servers".into(),
            "ok".into(),
            24,
            Some(serde_json::json!({ "id": "private-panel-id", "signal": "restart" })),
            Some(serde_json::json!({ "data": [{ "state": "running", "token": "private-token" }] })),
        );
        let events = list_panel_diagnostics();
        assert_eq!(events.len(), 1);
        let encoded = serde_json::to_string(events[0].details.as_ref().unwrap()).unwrap();
        assert!(encoded.contains("request"));
        assert!(encoded.contains("response"));
        assert!(encoded.contains("running"));
        assert!(encoded.contains("restart"));
        assert!(!encoded.contains("private-panel-id"));
        assert!(!encoded.contains("private-token"));
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
                request: Some(&serde_json::json!({"signal":"restart", "password":"private"})),
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
                let values = (0..64)
                    .map(|index| (format!("metric_{index}"), serde_json::json!(index)))
                    .collect::<Map<_, _>>();
                Value::Object(values)
            })
            .collect::<Vec<_>>();
        let response = serde_json::json!({"metrics": metrics});
        let details = bounded_api_details("api", "GET", Some(200), 1, None, None, Some(&response));
        assert!(serde_json::to_vec(&details).unwrap().len() < 1024);
        assert_eq!(
            details["response"]["json"]["_diagnostic"],
            "response_truncated"
        );
    }
}
