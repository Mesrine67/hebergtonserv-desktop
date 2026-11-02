use chrono::Utc;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

const CAPACITY: usize = 300;

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
    if total > 16 || failures > total { return; }
    let message = format!("Lot de ressources : {} réussies, {} échecs sur {}.", total - failures, failures, total);
    if let Ok(mut entries) = journal().lock() {
        if entries.len() == CAPACITY { entries.pop_front(); }
        entries.push_back(DiagnosticEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: if failures == 0 { "info" } else { "warning" },
            operation: "panel_resources".into(),
            code: "batch_summary".into(),
            message,
        });
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
    #[test]
    fn ignores_untrusted_codes_and_bounds_history() {
        clear_panel_diagnostics();
        record("error", "resource", "token=secret", "Échec");
        assert!(list_panel_diagnostics().is_empty());
        for _ in 0..310 {
            record("info", "resource", "ok", "Sans données sensibles");
        }
        assert_eq!(list_panel_diagnostics().len(), CAPACITY);
        clear_panel_diagnostics();
    }
}
