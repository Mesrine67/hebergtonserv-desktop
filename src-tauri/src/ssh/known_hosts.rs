use crate::errors::{Result, app_error};
use ssh_key::{HashAlg, PublicKey};
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct HostKeyEntry {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub key: String,
    pub comment: String,
    pub fingerprint: String,
}

pub fn trusted_hosts_path() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .map(|value| {
            std::path::PathBuf::from(value)
                .join("ssh")
                .join("known_hosts")
        })
        .or_else(|| {
            std::env::var_os("HOME").map(|value| {
                std::path::PathBuf::from(value)
                    .join(".ssh")
                    .join("known_hosts")
            })
        })
}

pub async fn scan_host_key(host: &str, port: u16) -> Result<HostKeyEntry> {
    let output = tokio::time::timeout(
        Duration::from_secs(15),
        tokio::process::Command::new("ssh-keyscan")
            .args([
                "-T",
                "5",
                "-t",
                "rsa,ecdsa,ed25519",
                "-p",
                &port.to_string(),
                host,
            ])
            .output(),
    )
    .await
    .map_err(|_| app_error("ssh_scan_failed", "La lecture des clés d'hôte a échoué."))?
    .map_err(|_| app_error("ssh_scan_failed", "La lecture des clés d'hôte a échoué."))?;
    if !output.status.success() {
        return Err(app_error(
            "ssh_scan_failed",
            "La lecture des clés d'hôte a échoué.",
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }
        let entry_host = parts[0].to_string();
        let key_type = parts[1].to_string();
        let key = parts[2].to_string();
        let comment = parts[3..].join(" ");
        let public_key = format!("{key_type} {key} {comment}");
        let Ok(parsed) = PublicKey::from_openssh(public_key.as_str()) else {
            continue;
        };
        let fingerprint = parsed.fingerprint(HashAlg::Sha256).to_string();
        return Ok(HostKeyEntry {
            host: entry_host,
            port,
            key_type,
            key,
            comment,
            fingerprint,
        });
    }
    Err(app_error(
        "ssh_scan_failed",
        "Aucune clé d'hôte n'a été trouvée.",
    ))
}

pub fn append_host_key(host: &str, port: u16, entry: &HostKeyEntry) -> Result<()> {
    let path = trusted_hosts_path()
        .ok_or_else(|| app_error("ssh_path_error", "Répertoire SSH introuvable."))?;
    let content = if path.exists() {
        std::fs::read_to_string(&path)?
    } else {
        String::new()
    };
    let marker = format!("[{host}]:{port}");
    let already = content.lines().any(|line| {
        let trimmed = line.trim();
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        parts.len() >= 3
            && parts[0] == marker
            && parts[1] == entry.key_type
            && parts[2] == entry.key
    });
    if already {
        return Ok(());
    }
    let mut new_content = content;
    if !new_content.is_empty() && !new_content.ends_with('\n') {
        new_content.push('\n');
    }
    new_content.push_str(&format!(
        "{} {} {} {}\n",
        marker, entry.key_type, entry.key, entry.comment
    ));
    if path.exists() {
        let backup = path.with_file_name("known_hosts.bak");
        let _ = std::fs::copy(&path, &backup);
    }
    std::fs::write(&path, &new_content)?;
    Ok(())
}

pub fn public_key_content_from_scan(
    entry: &HostKeyEntry,
) -> Result<crate::ssh::models::PublicKeyContent> {
    let public_key = format!("{} {} {}", entry.key_type, entry.key, entry.comment);
    let parsed = PublicKey::from_openssh(public_key.as_str())
        .map_err(|_| app_error("ssh_scan_failed", "Clé d'hôte invalide."))?;
    Ok(crate::ssh::models::PublicKeyContent {
        public_key: format!("{} {}", entry.key_type, entry.key),
        fingerprint: parsed.fingerprint(HashAlg::Sha256).to_string(),
        key_type: parsed.algorithm().as_str().to_string(),
        comment: entry.comment.clone(),
    })
}
