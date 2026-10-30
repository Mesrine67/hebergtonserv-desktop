pub mod models;

use crate::errors::{Result, app_error};
use std::path::PathBuf;

pub struct Storage {
    pub app_data_dir: PathBuf,
    pub log_dir: PathBuf,
    pub home_dir: PathBuf,
    pub ssh_dir: PathBuf,
    pub settings_path: PathBuf,
    pub panels_path: PathBuf,
    pub profiles_path: PathBuf,
}

impl Storage {
    pub fn new(
        app_data_dir: PathBuf,
        log_dir: PathBuf,
        home_dir: PathBuf,
        ssh_dir: PathBuf,
    ) -> Self {
        Self {
            app_data_dir: app_data_dir.clone(),
            log_dir,
            home_dir,
            ssh_dir,
            settings_path: app_data_dir.join("settings.json"),
            panels_path: app_data_dir.join("panels.json"),
            profiles_path: app_data_dir.join("profiles.json"),
        }
    }

    pub fn ensure_dirs(&self) -> Result<()> {
        std::fs::create_dir_all(&self.app_data_dir)?;
        std::fs::create_dir_all(&self.log_dir)?;
        std::fs::create_dir_all(&self.ssh_dir)?;
        Ok(())
    }

    pub fn atomic_write(path: &std::path::Path, contents: &str) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("data")
            .to_string();
        let temp = path.with_file_name(format!("{file_name}.tmp"));
        std::fs::write(&temp, contents)?;
        if path.exists() {
            let backup = path.with_file_name(format!("{file_name}.bak"));
            let _ = std::fs::copy(path, &backup);
        }
        std::fs::rename(&temp, path)?;
        Ok(())
    }

    pub fn read_json<T: serde::de::DeserializeOwned>(
        path: &std::path::Path,
        fallback: T,
    ) -> Result<T> {
        if !path.exists() {
            return Ok(fallback);
        }
        let content = std::fs::read_to_string(path)?;
        let value: serde_json::Value = serde_json::from_str(content.as_str()).map_err(|_| {
            app_error(
                "storage_corrupt",
                "Le fichier de données applicative est invalide.",
            )
        })?;
        let version = value
            .get("version")
            .and_then(|value| value.as_u64())
            .unwrap_or(0) as u32;
        if version > 1 {
            return Err(app_error(
                "storage_version",
                "Le format de données applicatives n'est plus compatible.",
            ));
        }
        if version == 0 {
            return Ok(fallback);
        }
        serde_json::from_value(value).map_err(|_| {
            app_error(
                "storage_corrupt",
                "Le fichier de données applicative est invalide.",
            )
        })
    }

    pub fn write_json<T: serde::Serialize>(
        path: &std::path::Path,
        document: &T,
        fallback_version: u32,
    ) -> Result<()> {
        let mut value = serde_json::to_value(document)
            .map_err(|_| app_error("storage_write", "Écriture impossible."))?;
        let obj = value
            .as_object_mut()
            .ok_or_else(|| app_error("storage_write", "Écriture impossible."))?;
        obj.insert("version".to_string(), serde_json::json!(fallback_version));
        let content = serde_json::to_string_pretty(&value)
            .map_err(|_| app_error("storage_write", "Écriture impossible."))?;
        Self::atomic_write(path, &content)?;
        Ok(())
    }
}
