pub mod models;

use crate::errors::{Result, app_error};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

static STORAGE_WRITE_LOCK: Mutex<()> = Mutex::new(());

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
        let _guard = STORAGE_WRITE_LOCK
            .lock()
            .map_err(|_| app_error("storage_write", "Verrou de stockage indisponible."))?;
        let parent = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| std::path::Path::new("."));
        std::fs::create_dir_all(parent)?;
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("data");
        let mut temp = tempfile::NamedTempFile::new_in(parent)?;
        temp.write_all(contents.as_bytes())?;
        temp.as_file().sync_all()?;
        if path.exists() {
            let backup = path.with_file_name(format!("{file_name}.bak"));
            let mut backup_temp = tempfile::NamedTempFile::new_in(parent)?;
            let mut original = std::fs::File::open(path)?;
            std::io::copy(&mut original, &mut backup_temp)?;
            backup_temp.as_file().sync_all()?;
            backup_temp.persist(backup).map_err(|error| error.error)?;
        }
        temp.persist(path).map_err(|error| error.error)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replacement_preserves_previous_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        Storage::atomic_write(&path, "first").unwrap();
        Storage::atomic_write(&path, "second").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "second");
        assert_eq!(
            std::fs::read_to_string(dir.path().join("settings.json.bak")).unwrap(),
            "first"
        );
    }

    #[test]
    fn concurrent_writes_remain_complete() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let threads: Vec<_> = (0..8)
            .map(|i| {
                let path = path.clone();
                std::thread::spawn(move || {
                    Storage::atomic_write(&path, &i.to_string().repeat(4096)).unwrap();
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        let contents = std::fs::read_to_string(&path).unwrap();
        assert_eq!(contents.len(), 4096);
        assert!(contents.bytes().all(|byte| byte == contents.as_bytes()[0]));
    }
}
