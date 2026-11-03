use chrono::Utc;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

const CAPACITY: usize = 1500;

#[derive(Clone, Serialize)]
pub struct DiagnosticEntry {
    pub timestamp: String,
    pub level: &'static str,
    pub operation: String,
    pub code: String,
    pub message: String,
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
    };
    if let Ok(mut events) = journal().lock() {
        if events.len() == CAPACITY {
            events.pop_front();
        }
        events.push_back(entry);
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
}
