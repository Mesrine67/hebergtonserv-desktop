use crate::errors::{Result, app_error};
use crate::ssh::models::AgentIdentity;
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AgentStatus {
    pub running: bool,
    pub source: String,
}

pub async fn agent_service_status() -> Result<AgentStatus> {
    let output = tokio::process::Command::new("sc")
        .args(["query", "ssh-agent"])
        .output()
        .await
        .map_err(|_| {
            app_error(
                "ssh_agent_error",
                "Impossible de contrôler l'agent SSH local.",
            )
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout)
        .to_string()
        .to_ascii_lowercase();
    let running = stdout.lines().any(|line| line.contains("running"));
    Ok(AgentStatus {
        running: running || output.status.success(),
        source: "sc".to_string(),
    })
}

pub async fn agent_identities() -> Result<Vec<AgentIdentity>> {
    let output = tokio::process::Command::new("ssh-add")
        .arg("-l")
        .output()
        .await
        .map_err(|_| {
            app_error(
                "ssh_agent_error",
                "Impossible d'interroger l'agent SSH local.",
            )
        })?;
    if !output.status.success() {
        return Ok(Vec::new());
    }
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut identities = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        identities.push(AgentIdentity {
            id: trimmed.to_string(),
            comment: Some(parts[2..].join(" ").to_string()),
            fingerprint: Some(parts[1].to_string()),
            source: "agent".to_string(),
        });
    }
    Ok(identities)
}

pub async fn agent_add_identity(ssh_dir: &Path, key_name: &str) -> Result<()> {
    let private_path = ssh_dir.join(key_name);
    let output = tokio::process::Command::new("ssh-add")
        .arg(private_path.to_string_lossy().as_ref())
        .output()
        .await
        .map_err(|_| {
            app_error(
                "ssh_agent_error",
                "Impossible d'ajouter une clé à l'agent SSH.",
            )
        })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr)
            .to_string()
            .to_ascii_lowercase();
        if stderr.contains("encrypted") || stderr.contains("passphrase") {
            return Err(app_error(
                "encrypted_key",
                "Clé protégée par phrase de passe : utilisez le terminal SSH pour l'ajouter.",
            ));
        }
        return Err(app_error(
            "ssh_agent_error",
            "L'ajout de l'identité à l'agent a échoué.",
        ));
    }
    Ok(())
}

pub async fn agent_remove_identity(ssh_dir: &Path, key_name: &str) -> Result<()> {
    let public_path = ssh_dir.join(format!("{key_name}.pub"));
    let private_path = ssh_dir.join(key_name);
    let target = if public_path.exists() {
        public_path
    } else {
        private_path
    };
    let output = tokio::process::Command::new("ssh-add")
        .args(["-d", &target.to_string_lossy()])
        .output()
        .await
        .map_err(|_| {
            app_error(
                "ssh_agent_error",
                "Impossible de retirer une identité de l'agent SSH.",
            )
        })?;
    if !output.status.success() {
        return Err(app_error(
            "ssh_agent_error",
            "Le retrait de l'identité de l'agent a échoué.",
        ));
    }
    Ok(())
}
