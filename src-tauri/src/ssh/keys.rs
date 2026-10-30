use crate::errors::{Result, app_error};
use crate::ssh::models::{PublicKeyContent, SshKeySummary, TrashEntry};
use serde::Deserialize;
use ssh_key::{Algorithm, HashAlg, LineEnding, PrivateKey, PublicKey};
use std::path::{Path, PathBuf};

pub fn is_valid_key_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

fn file_stem(file_name: &str) -> String {
    file_name
        .strip_suffix(".pub")
        .unwrap_or(file_name)
        .to_string()
}

fn key_type_string(algorithm: &Algorithm) -> String {
    algorithm.as_str().to_string()
}

pub fn public_key_file_for(private_key_file: &Path) -> Option<PathBuf> {
    let file_name = private_key_file.file_name()?.to_str()?.to_string();
    let public_name = format!("{}.pub", file_stem(&file_name));
    Some(private_key_file.parent()?.join(public_name))
}

pub fn scan_ssh_dir(ssh_dir: &Path) -> Vec<SshKeySummary> {
    let Ok(entries) = std::fs::read_dir(ssh_dir) else {
        return Vec::new();
    };
    let mut keys = Vec::new();
    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') || !entry.path().is_file() {
            continue;
        }
        let path = entry.path();
        if file_name.ends_with(".pub") {
            let id = file_stem(&file_name);
            let private_path = path.with_file_name(&id);
            if let Some(summary) = public_key_summary(&id, Some(&private_path), &path) {
                keys.push(summary);
            }
        } else if is_private_key_name(&file_name) {
            keys.push(private_key_summary(&file_name, &path));
        }
    }
    keys.sort_by(|a, b| a.name.cmp(&b.name));
    keys
}

fn is_private_key_name(file_name: &str) -> bool {
    let lower = file_name.to_ascii_lowercase();
    lower.contains("id_")
        || lower.contains("id_rsa")
        || lower.contains("id_ecdsa")
        || lower.contains("id_ed25519")
}

fn public_key_summary(
    id: &str,
    private_path: Option<&Path>,
    public_path: &Path,
) -> Option<SshKeySummary> {
    let content = std::fs::read_to_string(public_path).ok()?;
    let public_key = PublicKey::from_openssh(content.as_str()).ok()?;
    Some(SshKeySummary {
        id: id.to_string(),
        name: id.to_string(),
        public_key_file: Some(public_path.to_string_lossy().to_string()),
        private_key_file: private_path.map(|value| value.to_string_lossy().to_string()),
        key_type: Some(key_type_string(&public_key.algorithm())),
        fingerprint: Some(public_key.fingerprint(HashAlg::Sha256).to_string()),
        comment: Some(public_key.comment().to_string()),
        has_private: private_path.map(|value| value.exists()).unwrap_or(false),
        encrypted: false,
        permissions_warning: false,
    })
}

fn private_key_summary(file_name: &str, private_path: &Path) -> SshKeySummary {
    let mut summary = SshKeySummary {
        id: file_name.to_string(),
        name: file_name.to_string(),
        public_key_file: public_key_file_for(private_path)
            .map(|value| value.to_string_lossy().to_string()),
        private_key_file: Some(private_path.to_string_lossy().to_string()),
        key_type: None,
        fingerprint: None,
        comment: None,
        has_private: true,
        encrypted: false,
        permissions_warning: false,
    };
    if let Ok(content) = std::fs::read_to_string(private_path) {
        if let Ok(private_key) = PrivateKey::from_openssh(content.as_bytes()) {
            summary.encrypted = private_key.is_encrypted();
            if !private_key.is_encrypted() {
                let public_key = private_key.public_key();
                summary.key_type = Some(key_type_string(&public_key.algorithm()));
                summary.fingerprint = Some(public_key.fingerprint(HashAlg::Sha256).to_string());
                summary.comment = Some(public_key.comment().to_string());
            }
        }
    }
    summary
}

pub fn read_public_key(ssh_dir: &Path, id: &str) -> Result<PublicKeyContent> {
    let public_path = ssh_dir.join(format!("{id}.pub"));
    let private_path = ssh_dir.join(id);
    if public_path.exists() {
        let content = std::fs::read_to_string(&public_path)?;
        let public_key = PublicKey::from_openssh(content.as_str()).map_err(|_| {
            app_error(
                "invalid_public_key",
                "La clé publique importée n'est pas une clé SSH valide.",
            )
        })?;
        return Ok(PublicKeyContent {
            public_key: content.trim().to_string(),
            fingerprint: public_key.fingerprint(HashAlg::Sha256).to_string(),
            key_type: key_type_string(&public_key.algorithm()),
            comment: public_key.comment().to_string(),
        });
    }
    if private_path.exists() {
        let content = std::fs::read_to_string(&private_path)?;
        let private_key = PrivateKey::from_openssh(content.as_bytes())
            .map_err(|_| app_error("invalid_private_key", "Clé privée illisible ou invalide."))?;
        if private_key.is_encrypted() {
            return Err(app_error(
                "encrypted_key",
                "Clé privée protégée par phrase de passe : la clé publique n'est pas disponible localement.",
            ));
        }
        let public_key = private_key.public_key();
        return Ok(PublicKeyContent {
            public_key: public_key
                .to_openssh()
                .map_err(|_| app_error("invalid_public_key", "Clé publique invalide."))?
                .to_string(),
            fingerprint: public_key.fingerprint(HashAlg::Sha256).to_string(),
            key_type: key_type_string(&public_key.algorithm()),
            comment: public_key.comment().to_string(),
        });
    }
    Err(app_error("key_not_found", "Clé SSH introuvable."))
}

pub fn is_valid_public_key_content(content: &str) -> bool {
    if content.trim().len() > 16384 || content.to_ascii_uppercase().contains("PRIVATE KEY") {
        return false;
    }
    PublicKey::from_openssh(&content).is_ok()
}

#[derive(Debug, Clone, Deserialize)]
pub struct GenerateKeyInput {
    pub name: String,
    pub directory: Option<String>,
    pub key_type: String,
    pub bits: Option<u32>,
    pub passphrase: Option<String>,
    pub comment: String,
}

pub fn generate_ssh_key(input: &GenerateKeyInput, ssh_dir: &Path) -> Result<SshKeySummary> {
    if !is_valid_key_name(&input.name) {
        return Err(app_error(
            "invalid_key_name",
            "Le nom de clé doit contenir uniquement des lettres, chiffres, '.', '_' et '-' (64 caractères maximum).",
        ));
    }
    let directory = match &input.directory {
        Some(value) => {
            let path = PathBuf::from(value);
            let canonical = path.canonicalize().map_err(|_| {
                app_error("invalid_key_path", "Le dossier de sauvegarde doit exister.")
            })?;
            if canonical != ssh_dir && !canonical.starts_with(ssh_dir) {
                return Err(app_error(
                    "invalid_key_path",
                    "Le dossier de sauvegarde doit être dans le répertoire personnel.",
                ));
            }
            canonical
        }
        None => ssh_dir.to_path_buf(),
    };
    let private_path = directory.join(&input.name);
    let public_path = directory.join(format!("{}.pub", input.name));
    if private_path.exists() || public_path.exists() {
        return Err(app_error(
            "key_already_exists",
            "Une clé avec ce nom existe déjà. Aucune clé existante n'est écrasée.",
        ));
    }
    let mut rng = ssh_key::rand_core::OsRng;
    let algorithm = if input.key_type.eq_ignore_ascii_case("rsa") {
        Algorithm::Rsa { hash: None }
    } else if input.key_type.eq_ignore_ascii_case("ecdsa") {
        Algorithm::Ecdsa {
            curve: ssh_key::EcdsaCurve::NistP256,
        }
    } else {
        Algorithm::Ed25519
    };
    let mut private_key = PrivateKey::random(&mut rng, algorithm)?;
    private_key.set_comment(&input.comment);
    if let Some(passphrase) = &input.passphrase {
        if !passphrase.is_empty() {
            private_key = private_key.encrypt(&mut rng, passphrase.as_bytes())?;
        }
    }
    let private_pem = private_key
        .to_openssh(LineEnding::LF)
        .map_err(|_| app_error("key_generation", "La clé privée n'a pas pu être encodée."))?
        .to_string();
    let public_pem = private_key
        .public_key()
        .to_openssh()
        .map_err(|_| app_error("key_generation", "La clé publique n'a pu être encodée."))?
        .to_string();

    std::fs::write(&private_path, &private_pem)?;
    std::fs::write(&public_path, &public_pem)?;
    Ok(SshKeySummary {
        id: input.name.clone(),
        name: input.name.clone(),
        public_key_file: Some(public_path.to_string_lossy().to_string()),
        private_key_file: Some(private_path.to_string_lossy().to_string()),
        key_type: Some(key_type_string(&private_key.public_key().algorithm())),
        fingerprint: Some(
            private_key
                .public_key()
                .fingerprint(HashAlg::Sha256)
                .to_string(),
        ),
        comment: Some(private_key.comment().to_string()),
        has_private: true,
        encrypted: private_key.is_encrypted(),
        permissions_warning: false,
    })
}

pub fn delete_ssh_key(trash_id: &str, app_data_dir: &Path) -> Result<TrashEntry> {
    let entry_dir = app_data_dir.join("ssh-trash").join(trash_id);
    if !entry_dir.exists() {
        return Err(app_error(
            "trash_not_found",
            "Élément introuvable dans la corbeille SSH.",
        ));
    }
    let original_name = std::fs::read_to_string(entry_dir.join("original-name.txt"))
        .map_err(|_| app_error("io_error", "Corbeille illisible."))?;
    let private_file = std::fs::read_dir(&entry_dir)
        .ok()
        .and_then(|mut entries| {
            let mut found = None;
            for entry in entries.flatten() {
                let candidate = entry.path();
                if candidate.is_file() {
                    found = Some(candidate);
                }
            }
            found
        })
        .unwrap_or_else(|| entry_dir.clone());
    std::fs::remove_dir_all(&entry_dir)?;
    Ok(TrashEntry {
        trash_id: trash_id.to_string(),
        original_name: original_name.trim().to_string(),
        private_file: Some(private_file.to_string_lossy().to_string()),
        public_file: Some(
            private_file
                .with_extension("pub")
                .to_string_lossy()
                .to_string(),
        ),
    })
}

pub fn list_ssh_trash(app_data_dir: &Path) -> Vec<TrashEntry> {
    let trash_dir = app_data_dir.join("ssh-trash");
    let Ok(entries) = std::fs::read_dir(&trash_dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let original_name =
                std::fs::read_to_string(path.join("original-name.txt")).unwrap_or_default();
            let private_file = std::fs::read_dir(&path).ok().and_then(|mut dirs| {
                let mut found = None;
                for dir in dirs.flatten() {
                    if dir.path().is_file() {
                        found = Some(dir.path());
                    }
                }
                found
            });
            Some(TrashEntry {
                trash_id: entry.file_name().to_string_lossy().to_string(),
                original_name: original_name.trim().to_string(),
                private_file: private_file.map(|value| value.to_string_lossy().to_string()),
                public_file: None,
            })
        })
        .collect()
}

pub fn import_public_key_text(
    ssh_dir: &Path,
    name: &str,
    public_key: &str,
) -> Result<PublicKeyContent> {
    if !is_valid_key_name(name) {
        return Err(app_error(
            "invalid_key_name",
            "Le nom de clé doit contenir uniquement des lettres, chiffres, '.', '_' et '-' (64 caractères maximum).",
        ));
    }
    if !is_valid_public_key_content(public_key) {
        return Err(app_error(
            "invalid_public_key",
            "La clé publique saisie n'est pas une clé SSH valide.",
        ));
    }
    let content = public_key.trim().to_string();
    let parsed = PublicKey::from_openssh(content.as_str()).map_err(|_| {
        app_error(
            "invalid_public_key",
            "La clé publique saisie n'est pas une clé SSH valide.",
        )
    })?;
    let fingerprint = parsed.fingerprint(HashAlg::Sha256).to_string();
    let key_type = key_type_string(&parsed.algorithm());
    let comment = parsed.comment().to_string();
    let public_path = ssh_dir.join(format!("{name}.pub"));
    std::fs::write(&public_path, &content)?;
    Ok(PublicKeyContent {
        public_key: content,
        fingerprint,
        key_type,
        comment,
    })
}
