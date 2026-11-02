use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
pub struct ReleaseInfo {
    tag_name: String,
    name: String,
    body: String,
    published_at: Option<String>,
    html_url: String,
}

#[tauri::command]
pub async fn fetch_changelog() -> Result<Vec<ReleaseInfo>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent(format!(
            "HebergTonServ-Desktop/{}",
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .map_err(|e| format!("Initialisation du client HTTP : {e}"))?;
    let releases: Vec<serde_json::Value> = client
        .get("https://api.github.com/repos/Mesrine67/hebergtonserv-desktop/releases?per_page=8")
        .send()
        .await
        .map_err(|e| format!("Impossible de joindre GitHub : {e}"))?
        .error_for_status()
        .map_err(|e| format!("Réponse GitHub invalide : {e}"))?
        .json()
        .await
        .map_err(|e| format!("Notes de version illisibles : {e}"))?;
    Ok(releases
        .into_iter()
        .filter(|v| !v["draft"].as_bool().unwrap_or(true))
        .filter_map(|v| {
            let tag = v["tag_name"].as_str()?.to_owned();
            let url = v["html_url"].as_str()?.to_owned();
            if !url.starts_with("https://github.com/Mesrine67/hebergtonserv-desktop/releases/") {
                return None;
            }
            Some(ReleaseInfo {
                name: v["name"].as_str().unwrap_or(&tag).to_owned(),
                tag_name: tag,
                body: v["body"]
                    .as_str()
                    .unwrap_or("")
                    .chars()
                    .take(8000)
                    .collect(),
                published_at: v["published_at"].as_str().map(str::to_owned),
                html_url: url,
            })
        })
        .collect())
}

#[derive(Serialize)]
pub struct DesktopTask {
    pid: u32,
    name: String,
    memory_kib: u64,
}

/// Parse tasklist CSV output; double-quoted fields can contain commas.
fn csv_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '"' if quoted && chars.peek() == Some(&'"') => {
                current.push('"');
                chars.next();
            }
            '"' => quoted = !quoted,
            ',' if !quoted => {
                fields.push(std::mem::take(&mut current));
            }
            other => current.push(other),
        }
    }
    fields.push(current);
    fields
}

/// Read-only process overview. No arbitrary program termination is exposed.
#[tauri::command]
pub fn list_desktop_tasks() -> Result<Vec<DesktopTask>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let output = std::process::Command::new("tasklist.exe")
            .args(["/FO", "CSV", "/NH"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| format!("Lecture des processus Windows impossible : {e}"))?;
        if !output.status.success() {
            return Err("Windows n'a pas pu fournir la liste des processus.".into());
        }
        let mut tasks = Vec::new();
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let fields = csv_fields(line);
            if fields.len() < 5 {
                continue;
            }
            if let Ok(pid) = fields[1].trim().parse::<u32>() {
                let memory_kib = fields[4]
                    .chars()
                    .filter(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0);
                tasks.push(DesktopTask {
                    name: fields[0].clone(),
                    pid,
                    memory_kib,
                });
            }
        }
        tasks.sort_by(|a, b| b.memory_kib.cmp(&a.memory_kib));
        Ok(tasks)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn open_task_manager(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("task-manager") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "task-manager",
        tauri::WebviewUrl::App("index.html?view=tasks".into()),
    )
    .title("Gestionnaire de tâches — HébergTonServ")
    .inner_size(980.0, 630.0)
    .min_inner_size(710.0, 470.0)
    .resizable(true)
    .decorations(false)
    .center()
    .build()
    .map_err(|e| format!("Ouverture du gestionnaire de tâches impossible : {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn finish_main_window_close(app: tauri::AppHandle) -> Result<(), String> {
    use crate::{state::AppState, storage::Storage};
    let should_hide = app
        .try_state::<AppState>()
        .and_then(|state| {
            Storage::read_json(
                &state.storage.settings_path,
                crate::storage::models::SettingsDocument::default(),
            )
            .ok()
        })
        .map(|settings| settings.data.close_to_tray)
        .unwrap_or(false);
    if should_hide {
        app.get_webview_window("main")
            .ok_or_else(|| "Fenêtre principale introuvable".to_string())?
            .hide()
            .map_err(|e| e.to_string())
    } else {
        app.exit(0);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::csv_fields;
    #[test]
    fn parses_windows_tasklist_csv_with_quoted_commas() {
        assert_eq!(
            csv_fields("\"A,B.exe\",\"15\",\"Console\",\"1\",\"24,000 K\"").len(),
            5
        );
        assert_eq!(
            csv_fields("\"A,B.exe\",\"15\",\"Console\",\"1\",\"24,000 K\"")[0],
            "A,B.exe"
        );
    }
}
