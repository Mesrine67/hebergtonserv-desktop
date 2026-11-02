//! Explicit, read-only local Git discovery. No shell, credentials, network or mutation.
use crate::errors::{Result, app_error};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

const EXECUTION_LIMIT: Duration = Duration::from_secs(8);
const OUTPUT_LIMIT: usize = 256 * 1024;

#[derive(Debug, Serialize)]
pub struct GitTools {
    pub git: Option<String>,
    pub gh: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub subject: String,
}

#[derive(Debug, Serialize)]
pub struct GitSnapshot {
    pub root: String,
    pub branch: String,
    pub changes: Vec<String>,
    pub changes_truncated: bool,
    pub commits: Vec<GitCommit>,
}

async fn tool_output(executable: &str, args: &[&str], directory: Option<&Path>) -> Result<String> {
    let mut command = Command::new(executable);
    command
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", "NUL")
        .env_remove("GIT_CONFIG_COUNT")
        .env_remove("GIT_CONFIG_KEY_0")
        .env_remove("GIT_CONFIG_VALUE_0")
        .kill_on_drop(true);
    if let Some(directory) = directory {
        command.current_dir(directory);
    }
    let output = timeout(EXECUTION_LIMIT, command.output())
        .await
        .map_err(|_| app_error("git_timeout", "Commande Git interrompue après 8 secondes."))?
        .map_err(|_| app_error("git_unavailable", "L'exécutable Git ou gh est introuvable."))?;
    if !output.status.success() {
        return Err(app_error(
            "git_failed",
            "La commande Git a échoué. Vérifiez le dépôt sélectionné.",
        ));
    }
    if output.stdout.len() > OUTPUT_LIMIT {
        return Err(app_error(
            "git_too_large",
            "Résultat Git trop volumineux pour cet aperçu.",
        ));
    }
    String::from_utf8(output.stdout)
        .map(|data| data.trim().to_owned())
        .map_err(|_| app_error("git_encoding", "La sortie Git n'est pas en UTF-8."))
}

async fn git_read(repository: &Path, args: &[&str]) -> Result<String> {
    // Disable hooks and fsmonitor even when the selected repository is untrusted.
    let mut all = vec!["-c", "core.fsmonitor=false", "-c", "core.hooksPath=NUL"];
    all.extend_from_slice(args);
    tool_output("git", &all, Some(repository)).await
}

#[tauri::command]
pub async fn get_git_tools() -> GitTools {
    let git = tool_output("git", &["--version"], None).await.ok();
    let gh = tool_output("gh", &["--version"], None)
        .await
        .ok()
        .and_then(|data| data.lines().next().map(str::to_owned));
    GitTools { git, gh }
}

async fn inspect_repository(directory: &Path) -> Result<GitSnapshot> {
    let path: PathBuf = std::fs::canonicalize(directory)
        .map_err(|_| app_error("git_path", "Le dossier sélectionné n'existe plus."))?;
    if !path.is_dir() {
        return Err(app_error(
            "git_path",
            "Sélectionnez un dossier et non un fichier.",
        ));
    }

    let root = git_read(&path, &["rev-parse", "--show-toplevel"]).await?;
    let branch = git_read(&path, &["branch", "--show-current"]).await?;
    // -uno avoids automatically enumerating private untracked files.
    let status = git_read(&path, &["status", "--porcelain=v1", "--untracked-files=no"]).await?;
    let changes: Vec<String> = status.lines().take(100).map(str::to_owned).collect();
    let changes_truncated = status.lines().count() > changes.len();

    // A freshly initialized repository has no HEAD commit yet.
    let history = if git_read(&path, &["rev-parse", "--verify", "HEAD"])
        .await
        .is_ok()
    {
        git_read(
            &path,
            &[
                "log",
                "-8",
                "--pretty=format:%h%x09%s",
                "--no-show-signature",
            ],
        )
        .await?
    } else {
        String::new()
    };
    let commits = history
        .lines()
        .filter_map(|line| line.split_once('\t'))
        .map(|(hash, subject)| GitCommit {
            hash: hash.to_owned(),
            subject: subject.chars().take(280).collect(),
        })
        .collect();

    Ok(GitSnapshot {
        root,
        branch,
        changes,
        changes_truncated,
        commits,
    })
}

#[tauri::command]
pub async fn inspect_git_repository(path: String) -> Result<GitSnapshot> {
    if path.trim().is_empty() || path.len() > 4096 {
        return Err(app_error(
            "git_path",
            "Choisissez explicitement un dossier local.",
        ));
    }
    inspect_repository(Path::new(&path)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn invalid_directory_is_rejected_without_scanning() {
        let result = inspect_repository(Path::new("Z:/hts-nonexistent-repo-for-test")).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn temporary_repository_has_no_credentials_or_remote_access() {
        if tool_output("git", &["--version"], None).await.is_err() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let mut init = Command::new("git");
        let output = init
            .arg("init")
            .arg("-q")
            .arg(dir.path())
            .output()
            .await
            .unwrap();
        assert!(output.status.success());
        let snapshot = inspect_repository(dir.path()).await.unwrap();
        assert!(!snapshot.root.is_empty());
        assert!(snapshot.commits.is_empty());
        assert!(snapshot.changes.is_empty());
    }
}
