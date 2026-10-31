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
    crate::ssh::paths::ssh_dir().map(|dir| dir.join("known_hosts"))
}

fn validate_target(host: &str, port: u16) -> Result<()> {
    if host.is_empty()
        || port == 0
        || host.starts_with('-')
        || host
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || matches!(c, '/' | '\\' | '@'))
    {
        return Err(app_error(
            "ssh_invalid_host",
            "Nom d'hôte ou port SSH invalide.",
        ));
    }
    Ok(())
}

pub async fn scan_host_key(host: &str, port: u16) -> Result<HostKeyEntry> {
    validate_target(host, port)?;
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
    validate_target(host, port)?;
    let bracketed_host = format!("[{host}]:{port}");
    if entry.port != port || (entry.host != host && entry.host != bracketed_host) {
        return Err(app_error(
            "ssh_host_mismatch",
            "L'identité de l'hôte scanné ne correspond pas à l'hôte sélectionné.",
        ));
    }

    let public_key = PublicKey::from_openssh(&format!(
        "{} {} {}",
        entry.key_type, entry.key, entry.comment
    ))
    .map_err(|_| app_error("ssh_invalid_host_key", "Clé d'hôte SSH invalide."))?;
    if entry.fingerprint != public_key.fingerprint(HashAlg::Sha256).to_string() {
        return Err(app_error(
            "ssh_fingerprint_mismatch",
            "L'empreinte de la clé d'hôte a changé.",
        ));
    }

    let path = trusted_hosts_path()
        .ok_or_else(|| app_error("ssh_path_error", "Répertoire SSH introuvable."))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let existing = if path.exists() {
        std::fs::read_to_string(&path)?
    } else {
        String::new()
    };
    let marker = if port == 22 {
        host.to_string()
    } else {
        bracketed_host.clone()
    };
    for line in existing.lines() {
        let fields: Vec<_> = line.split_whitespace().collect();
        if fields.len() < 3 {
            continue;
        }
        if fields[0] != marker && fields[0] != bracketed_host {
            continue;
        }
        if fields[1] == entry.key_type {
            if fields[2] == entry.key {
                return Ok(());
            }
            return Err(app_error(
                "ssh_host_key_conflict",
                "Une clé différente existe déjà pour cet hôte et cet algorithme. Vérifiez le changement hors bande avant toute modification.",
            ));
        }
    }

    // Preserve the existing file and append only the explicitly approved key.
    let mut content = existing;
    if !content.is_empty() && !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&format!("{} {} {}\n", marker, entry.key_type, entry.key));
    if path.exists() {
        std::fs::copy(&path, path.with_file_name("known_hosts.bak"))?;
    }
    std::fs::write(&path, content)?;
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

#[cfg(test)]
mod host_validation_tests {
    use super::*;

    #[test]
    fn uses_standard_windows_openssh_known_hosts_directory() {
        let ssh_dir = crate::ssh::paths::ssh_dir().expect("home dir");
        let path = trusted_hosts_path().expect("known_hosts path");
        assert_eq!(path, ssh_dir.join("known_hosts"));
        assert_eq!(ssh_dir.file_name().unwrap(), ".ssh");
    }

    #[test]
    fn rejects_invalid_targets() {
        for host in [
            "",
            "-oProxyCommand=evil",
            "two words",
            "host\nother",
            "a/b",
            "user@host",
        ] {
            assert!(validate_target(host, 22).is_err());
        }
        assert!(validate_target("example.com", 0).is_err());
        assert!(validate_target("example.com", 22).is_ok());
        assert!(validate_target("2001:db8::1", 2202).is_ok());
    }

    #[test]
    fn rejects_mismatched_scan_before_touching_known_hosts() {
        let entry = HostKeyEntry {
            host: "other.example".to_owned(),
            port: 22,
            key_type: "ssh-ed25519".to_owned(),
            key: "invalid".to_owned(),
            comment: String::new(),
            fingerprint: "SHA256:fake".to_owned(),
        };
        assert!(append_host_key("example.com", 22, &entry).is_err());
    }
}
