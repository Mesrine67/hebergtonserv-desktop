use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::{Emitter, Manager};

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
    cpu_percent: Option<f32>,
    memory_kib: u64,
    session_name: String,
    session_number: String,
}

#[derive(Default)]
struct CpuSampler {
    last_sample: Option<Instant>,
    previous: HashMap<u32, u64>,
}

static TASK_CPU_SAMPLER: OnceLock<Mutex<CpuSampler>> = OnceLock::new();

fn attach_cpu_percent(tasks: &mut [DesktopTask]) {
    let now = Instant::now();
    let sampler = TASK_CPU_SAMPLER.get_or_init(|| Mutex::new(CpuSampler::default()));
    let Ok(mut sampler) = sampler.lock() else {
        return;
    };
    let elapsed = sampler
        .last_sample
        .map(|last| now.duration_since(last).as_secs_f64());
    let logical_cpus = std::thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
        .max(1) as f64;
    let mut current = HashMap::with_capacity(tasks.len());
    for task in tasks.iter_mut() {
        let Some(total) = process_cpu_time_100ns(task.pid) else {
            task.cpu_percent = None;
            continue;
        };
        task.cpu_percent = elapsed
            .filter(|seconds| *seconds > 0.0)
            .and_then(|seconds| {
                sampler
                    .previous
                    .get(&task.pid)
                    .map(|previous| (seconds, *previous))
            })
            .filter(|(_, previous)| total >= *previous)
            .map(|(seconds, previous)| {
                (((total - previous) as f64 / 10_000_000.0 / seconds / logical_cpus) * 100.0)
                    .clamp(0.0, 100.0) as f32
            });
        current.insert(task.pid, total);
    }
    sampler.previous = current;
    sampler.last_sample = Some(now);
}

#[cfg(target_os = "windows")]
fn process_cpu_time_100ns(pid: u32) -> Option<u64> {
    use std::mem::MaybeUninit;
    use windows_sys::Win32::Foundation::{CloseHandle, FILETIME};
    use windows_sys::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        return None;
    }
    let mut creation = MaybeUninit::<FILETIME>::uninit();
    let mut exit = MaybeUninit::<FILETIME>::uninit();
    let mut kernel = MaybeUninit::<FILETIME>::uninit();
    let mut user = MaybeUninit::<FILETIME>::uninit();
    let success = unsafe {
        GetProcessTimes(
            handle,
            creation.as_mut_ptr(),
            exit.as_mut_ptr(),
            kernel.as_mut_ptr(),
            user.as_mut_ptr(),
        )
    };
    unsafe { CloseHandle(handle) };
    if success == 0 {
        return None;
    }
    let kernel = unsafe { kernel.assume_init() };
    let user = unsafe { user.assume_init() };
    Some(
        ((u64::from(kernel.dwHighDateTime) << 32) | u64::from(kernel.dwLowDateTime))
            .saturating_add((u64::from(user.dwHighDateTime) << 32) | u64::from(user.dwLowDateTime)),
    )
}

#[cfg(not(target_os = "windows"))]
fn process_cpu_time_100ns(_pid: u32) -> Option<u64> {
    None
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
pub async fn list_desktop_tasks() -> Result<Vec<DesktopTask>, String> {
    #[cfg(target_os = "windows")]
    {
        let task = tauri::async_runtime::spawn_blocking(|| {
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
                        cpu_percent: None,
                        memory_kib,
                        session_name: fields[2].trim().to_owned(),
                        session_number: fields[3].trim().to_owned(),
                    });
                }
            }
            attach_cpu_percent(&mut tasks);
            tasks.sort_by_key(|task| std::cmp::Reverse(task.memory_kib));
            Ok::<Vec<DesktopTask>, String>(tasks)
        });
        let result = tokio::time::timeout(std::time::Duration::from_secs(8), task)
            .await
            .map_err(|_| "Lecture des processus Windows trop longue (8 s).".to_string())?
            .map_err(|_| "Lecture des processus Windows interrompue.".to_string())?;
        if let Ok(tasks) = &result {
            let total_memory_kib = tasks.iter().map(|task| task.memory_kib).sum();
            crate::diagnostics::record_task_snapshot(tasks.len(), total_memory_kib);
        } else {
            crate::diagnostics::record(
                "warning",
                "windows_tasks",
                "snapshot_failed",
                "Lecture de la liste des processus impossible",
            );
        }
        result
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn open_task_manager(app: tauri::AppHandle) -> Result<(), String> {
    // Reuse the existing main WebView instead of spawning an intermittently
    // blank second WebView2 window. Keep the command for existing callers.
    app.get_webview_window("main")
        .ok_or_else(|| "Fenêtre principale introuvable".to_string())?
        .emit("hts:open-task-manager", ())
        .map_err(|_| "Ouverture du gestionnaire impossible.".to_string())
}

/// Show the main window only after the initial React frame is rendered.
#[tauri::command]
pub fn show_ready_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if std::env::args_os().any(|arg| arg == "--minimized") {
        return Ok(());
    }
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Fenêtre principale introuvable".to_string())?;
    let size = window.inner_size().map_err(|error| error.to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    if size.width as f64 / scale < 700.0 || size.height as f64 / scale < 500.0 {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize::new(1280.0, 820.0)))
            .map_err(|error| error.to_string())?;
        window
            .set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(
                960.0, 640.0,
            ))))
            .map_err(|error| error.to_string())?;
        window.center().map_err(|error| error.to_string())?;
    }
    window.show().map_err(|error| error.to_string())?;
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
    use super::{DesktopTask, attach_cpu_percent, csv_fields};
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

    #[test]
    fn cpu_sample_starts_unknown_when_process_cannot_be_read() {
        let mut tasks = vec![DesktopTask {
            pid: u32::MAX,
            name: "test".into(),
            cpu_percent: None,
            memory_kib: 1,
            session_name: "Console".into(),
            session_number: "1".into(),
        }];
        attach_cpu_percent(&mut tasks);
        assert_eq!(tasks[0].cpu_percent, None);
    }
}
