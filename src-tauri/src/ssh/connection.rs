use crate::errors::{Result, app_error};
use crate::ssh::known_hosts::trusted_hosts_path;
use crate::ssh::models::SshConnectionResult;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct TestConnectionInput<'a> {
    pub host: &'a str,
    pub port: u16,
    pub username: &'a str,
    pub auth_method: &'a str,
    pub key_name: Option<&'a str>,
}

pub fn ssh_binary() -> Result<PathBuf> {
    for candidate in [
        r"C:\Windows\System32\OpenSSH\ssh.exe",
        r"C:\Windows\System32\ssh.exe",
    ] {
        let path = std::path::PathBuf::from(candidate);
        if path.exists() {
            return Ok(path);
        }
    }
    Err(app_error(
        "ssh_tool_missing",
        "L'outil OpenSSH (ssh.exe) est introuvable.",
    ))
}

fn known_hosts_argument() -> String {
    trusted_hosts_path()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            format!(
                "{}/.ssh/known_hosts",
                std::env::var("HOME").unwrap_or_default()
            )
        })
}

fn base_args(key_path: Option<&str>, batch_mode: bool) -> Vec<String> {
    let mut args = Vec::new();
    if batch_mode {
        args.push("BatchMode=yes".to_string());
        args.push("ConnectTimeout=8".to_string());
        args.push("ConnectionAttempts=1".to_string());
        args.push("StrictHostKeyChecking=yes".to_string());
        args.push("IdentitiesOnly=yes".to_string());
        args.push("PasswordAuthentication=no".to_string());
    }
    if let Some(path) = key_path {
        args.push("-i".to_string());
        args.push(path.to_string());
    }
    args.push("-o".to_string());
    args.push(format!("UserKnownHostsFile={}", known_hosts_argument()));
    args
}

fn ssh_target(input: &TestConnectionInput<'_>) -> String {
    format!("{}@{}", input.username, input.host)
}

pub async fn test_ssh_connection(input: &TestConnectionInput<'_>) -> Result<SshConnectionResult> {
    if input.auth_method == "password" {
        return Ok(SshConnectionResult {
            state: "password_not_supported".to_string(),
            message:
                "Les tests automatiques ne supportent pas l'authentification par mot de passe."
                    .to_string(),
        });
    }
    let binary = ssh_binary()?;
    let key_path = input.key_name.and_then(|key_name| {
        let ssh_dir = crate::ssh::ssh_dir_path()?;
        Some(ssh_dir.join(key_name).to_string_lossy().to_string())
    });
    let mut command = tokio::process::Command::new(&binary);
    for arg in base_args(key_path.as_deref(), true) {
        command.arg(&arg);
    }
    command
        .arg("-p")
        .arg(input.port.to_string())
        .arg(ssh_target(input));
    let output = tokio::time::timeout(Duration::from_secs(25), command.output())
        .await
        .map_err(|_| {
            app_error(
                "ssh_timeout",
                "Le test de connexion SSH a dépassé le délai.",
            )
        })?
        .map_err(|_| app_error("ssh_error", "L'exécution du client SSH a échoué."))?;
    if output.status.success() {
        return Ok(SshConnectionResult {
            state: "ok".to_string(),
            message: "Authentification réussie.".to_string(),
        });
    }
    let stderr = String::from_utf8_lossy(&output.stderr)
        .to_string()
        .to_lowercase();
    let state = if stderr.contains("host key verification failed") {
        "host_key_unknown"
    } else if stderr.contains("permission denied") || stderr.contains("authentication failed") {
        "auth_failed"
    } else if stderr.contains("timed out") || stderr.contains("timeout") {
        "timeout"
    } else if stderr.contains("could not resolve")
        || stderr.contains("name or service not known")
        || stderr.contains("connection refused")
    {
        "unreachable"
    } else {
        "error"
    };
    Ok(SshConnectionResult {
        state: state.to_string(),
        message: "Le client SSH a refusé la connexion.".to_string(),
    })
}

pub async fn open_ssh_connection(input: &TestConnectionInput<'_>) -> Result<()> {
    let binary = ssh_binary()?;
    let key_path = input.key_name.and_then(|key_name| {
        let ssh_dir = crate::ssh::ssh_dir_path()?;
        Some(ssh_dir.join(key_name).to_string_lossy().to_string())
    });
    let mut command = tokio::process::Command::new(&binary);
    #[cfg(windows)]
    command.creation_flags(0x00000010);
    for arg in base_args(key_path.as_deref(), false) {
        command.arg(&arg);
    }
    command
        .arg("-p")
        .arg(input.port.to_string())
        .arg(ssh_target(input));
    let _child = command
        .spawn()
        .map_err(|_| app_error("ssh_error", "Lancement du client SSH impossible."))?;
    Ok(())
}

#[cfg(test)]
mod path_tests {
    use super::*;

    #[test]
    fn ssh_test_and_interactive_session_share_known_hosts_path() {
        let trusted = trusted_hosts_path().expect("SSH path");
        assert_eq!(known_hosts_argument(), trusted.to_string_lossy());
        let automated = base_args(None, true);
        let interactive = base_args(None, false);
        let expected = format!("UserKnownHostsFile={}", trusted.display());
        assert!(automated.contains(&expected));
        assert!(interactive.contains(&expected));
        assert!(
            automated
                .iter()
                .any(|arg| arg == "StrictHostKeyChecking=yes")
        );
    }
}
