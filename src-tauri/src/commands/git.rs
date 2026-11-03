//! Explicit local Git inspection and explicit, read-only GitHub CLI queries.
//! Commands use argument arrays (never a shell); GitHub auth stays inside `gh`.
use crate::errors::{Result, app_error};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

const EXECUTION_LIMIT: Duration = Duration::from_secs(8);
const NETWORK_EXECUTION_LIMIT: Duration = Duration::from_secs(120);
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

#[derive(Debug, Clone, Serialize)]
pub struct GitHubActivity {
    pub repository: String,
    pub authenticated: bool,
    pub pull_requests: Vec<GitHubEntry>,
    pub issues: Vec<GitHubEntry>,
    pub issues_available: bool,
}

#[derive(Debug, Serialize)]
pub struct GitMutationResult {
    pub action: String,
    pub branch: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitHubEntry {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub url: String,
    pub updated_at: Option<String>,
    pub labels: Vec<String>,
    pub head_branch: Option<String>,
    pub base_branch: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GhEntry {
    number: u64,
    title: String,
    state: String,
    url: String,
    updated_at: Option<String>,
    #[serde(default)]
    labels: Vec<GhLabel>,
    head_ref_name: Option<String>,
    base_ref_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GhLabel {
    name: String,
}

fn parse_github_repository(remote: &str) -> Result<String> {
    let (host, path) = if let Some(value) = remote.strip_prefix("git@github.com:") {
        ("github.com".to_owned(), value.to_owned())
    } else {
        let url = url::Url::parse(remote)
            .map_err(|_| app_error("github_remote", "Le dépôt origin n'est pas GitHub.com."))?;
        let host = url.host_str().unwrap_or_default();
        let valid_credentials = match url.scheme() {
            "https" => url.username().is_empty() && url.password().is_none(),
            "ssh" => url.username() == "git" && url.password().is_none(),
            _ => false,
        };
        let valid_port = match url.scheme() {
            "https" => url.port().is_none_or(|port| port == 443),
            "ssh" => url.port().is_none_or(|port| port == 22),
            _ => false,
        };
        if !valid_credentials || !valid_port {
            return Err(app_error(
                "github_remote",
                "Le remote GitHub doit être une URL publique sans identifiants intégrés.",
            ));
        }
        (
            host.to_owned(),
            url.path().trim_start_matches('/').to_owned(),
        )
    };
    if !host.eq_ignore_ascii_case("github.com") {
        return Err(app_error(
            "github_remote",
            "Seuls les remotes GitHub.com sont pris en charge.",
        ));
    }
    let path = path.strip_suffix(".git").unwrap_or(&path);
    let parts: Vec<&str> = path.split('/').collect();
    let valid_component = |part: &str| {
        !part.is_empty()
            && part.len() <= 100
            && part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
            && part != "."
            && part != ".."
    };
    if parts.len() != 2 || !parts.iter().all(|part| valid_component(part)) {
        return Err(app_error(
            "github_remote",
            "Le remote GitHub n'identifie pas un dépôt valide.",
        ));
    }
    Ok(format!("{}/{}", parts[0], parts[1]))
}

fn validate_github_entry(entry: GhEntry, pull_request: bool) -> Result<GitHubEntry> {
    let url = url::Url::parse(&entry.url)
        .map_err(|_| app_error("github_response", "GitHub a renvoyé un lien invalide."))?;
    if url.scheme() != "https" || url.host_str() != Some("github.com") || !url.username().is_empty()
    {
        return Err(app_error(
            "github_response",
            "GitHub a renvoyé un lien non sécurisé.",
        ));
    }
    Ok(GitHubEntry {
        number: entry.number,
        title: entry.title.chars().take(300).collect(),
        state: entry.state.chars().take(24).collect(),
        url: url.to_string(),
        updated_at: entry
            .updated_at
            .map(|value| value.chars().take(40).collect()),
        labels: entry
            .labels
            .into_iter()
            .take(20)
            .map(|label| label.name.chars().take(80).collect())
            .collect(),
        head_branch: pull_request
            .then_some(entry.head_ref_name)
            .flatten()
            .map(|value| value.chars().take(120).collect()),
        base_branch: pull_request
            .then_some(entry.base_ref_name)
            .flatten()
            .map(|value| value.chars().take(120).collect()),
    })
}

fn issues_disabled(stderr: &[u8]) -> bool {
    String::from_utf8_lossy(stderr).contains("has disabled issues")
}

async fn gh_output<T: for<'de> Deserialize<'de>>(args: &[&str]) -> Result<T> {
    let output = timeout(EXECUTION_LIMIT, async {
        Command::new("gh")
            .args(args)
            .env("GH_PROMPT_DISABLED", "1")
            .env("GH_NO_UPDATE_NOTIFIER", "1")
            .env("GH_PAGER", "cat")
            .env("NO_COLOR", "1")
            .kill_on_drop(true)
            .output()
            .await
    })
    .await
    .map_err(|_| {
        app_error(
            "github_timeout",
            "La requête GitHub a dépassé le délai autorisé.",
        )
    })?
    .map_err(|_| app_error("gh_unavailable", "GitHub CLI gh est introuvable."))?;
    if !output.status.success() {
        if issues_disabled(&output.stderr) {
            return Err(app_error(
                "github_issues_disabled",
                "Les issues sont désactivées pour ce dépôt GitHub.",
            ));
        }
        return Err(app_error(
            "github_query",
            "Impossible de lire les données GitHub du dépôt sélectionné.",
        ));
    }
    if output.stdout.len() > OUTPUT_LIMIT {
        return Err(app_error(
            "github_query",
            "La réponse GitHub dépasse la taille autorisée.",
        ));
    }
    serde_json::from_slice(&output.stdout).map_err(|_| {
        app_error(
            "github_response",
            "La réponse GitHub n'est pas au format attendu.",
        )
    })
}

#[tauri::command]
pub async fn get_github_activity(path: String) -> Result<GitHubActivity> {
    if path.trim().is_empty() || path.len() > 4096 {
        return Err(app_error(
            "git_path",
            "Choisissez explicitement un dépôt local.",
        ));
    }
    let path = std::fs::canonicalize(&path)
        .map_err(|_| app_error("git_path", "Le dossier sélectionné n'existe plus."))?;
    let root = git_read(&path, &["rev-parse", "--show-toplevel"]).await?;
    let root = Path::new(&root);
    let remote = git_read(root, &["remote", "get-url", "origin"]).await?;
    let repository = parse_github_repository(&remote)?;
    let auth = timeout(EXECUTION_LIMIT, async {
        Command::new("gh")
            .args(["auth", "status", "--hostname", "github.com", "--active"])
            .env("GH_PROMPT_DISABLED", "1")
            .env("GH_NO_UPDATE_NOTIFIER", "1")
            .env("GH_PAGER", "cat")
            .env("NO_COLOR", "1")
            .kill_on_drop(true)
            .output()
            .await
    })
    .await
    .map_err(|_| {
        app_error(
            "github_timeout",
            "La vérification de session GitHub a expiré.",
        )
    })?
    .map_err(|_| app_error("gh_unavailable", "GitHub CLI gh est introuvable."))?;
    if !auth.status.success() {
        return Ok(GitHubActivity {
            repository,
            authenticated: false,
            pull_requests: Vec::new(),
            issues: Vec::new(),
            issues_available: false,
        });
    }

    let prs: Vec<GhEntry> = gh_output(&[
        "pr",
        "list",
        "--repo",
        &format!("github.com/{repository}"),
        "--state",
        "all",
        "--limit",
        "30",
        "--json",
        "number,title,state,url,updatedAt,headRefName,baseRefName",
    ])
    .await?;
    let issue_result: Result<Vec<GhEntry>> = gh_output(&[
        "issue",
        "list",
        "--repo",
        &format!("github.com/{repository}"),
        "--state",
        "all",
        "--limit",
        "30",
        "--json",
        "number,title,state,url,updatedAt,labels",
    ])
    .await;
    let (issues, issues_available) = match issue_result {
        Ok(issues) => (issues, true),
        Err(error) if error.code() == "github_issues_disabled" => (Vec::new(), false),
        Err(error) => return Err(error),
    };
    Ok(GitHubActivity {
        repository,
        authenticated: true,
        pull_requests: prs
            .into_iter()
            .map(|entry| validate_github_entry(entry, true))
            .collect::<Result<Vec<_>>>()?,
        issues: issues
            .into_iter()
            .map(|entry| validate_github_entry(entry, false))
            .collect::<Result<Vec<_>>>()?,
        issues_available,
    })
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

async fn git_network_action(repository: &Path, args: &[&str]) -> Result<()> {
    let mut command = Command::new("git");
    command
        .args(["-c", "core.fsmonitor=false", "-c", "core.hooksPath=NUL"])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_PAGER", "cat")
        .env("GCM_INTERACTIVE", "Never")
        .env("GCM_MODAL_PROMPT", "Never")
        .kill_on_drop(true)
        .current_dir(repository);
    let output = timeout(NETWORK_EXECUTION_LIMIT, command.output())
        .await
        .map_err(|_| {
            app_error(
                "git_timeout",
                "L'opération Git a dépassé le délai autorisé.",
            )
        })?
        .map_err(|_| app_error("git_unavailable", "L'exécutable Git est introuvable."))?;
    if !output.status.success() {
        return Err(app_error(
            "git_network_action",
            "L'opération Git a échoué. Vérifiez la connexion, les droits et l'état du dépôt.",
        ));
    }
    if output.stdout.len().saturating_add(output.stderr.len()) > OUTPUT_LIMIT {
        return Err(app_error(
            "git_too_large",
            "La sortie Git dépasse la taille autorisée.",
        ));
    }
    Ok(())
}

fn upstream_branch(upstream: &str) -> Option<&str> {
    let (remote, branch) = upstream.split_once('/')?;
    (remote == "origin" && !branch.is_empty()).then_some(branch)
}

fn require_clean_worktree(status: &str) -> Result<()> {
    if status.is_empty() {
        Ok(())
    } else {
        Err(app_error(
            "git_worktree_dirty",
            "Pull refusé : validez ou mettez à l'abri les changements locaux avant de continuer.",
        ))
    }
}

async fn selected_github_repository(path: &str) -> Result<PathBuf> {
    if path.trim().is_empty() || path.len() > 4096 {
        return Err(app_error(
            "git_path",
            "Choisissez explicitement un dépôt local.",
        ));
    }
    let path = std::fs::canonicalize(path)
        .map_err(|_| app_error("git_path", "Le dossier sélectionné n'existe plus."))?;
    let root = git_read(&path, &["rev-parse", "--show-toplevel"]).await?;
    let root = PathBuf::from(root);
    let fetch_url = git_read(&root, &["remote", "get-url", "origin"]).await?;
    let repository = parse_github_repository(&fetch_url)?;
    let push_url = git_read(&root, &["remote", "get-url", "--push", "origin"]).await?;
    if parse_github_repository(&push_url)? != repository {
        return Err(app_error(
            "git_remote",
            "Les destinations origin de lecture et d'écriture ne correspondent pas.",
        ));
    }
    Ok(root)
}

#[tauri::command]
pub async fn mutate_git_repository(path: String, action: String) -> Result<GitMutationResult> {
    if !matches!(action.as_str(), "fetch" | "pull" | "push") {
        return Err(app_error("git_action", "Action Git non reconnue."));
    }
    let root = selected_github_repository(&path).await?;
    let branch = git_read(&root, &["branch", "--show-current"]).await?;
    if branch.is_empty() {
        return Err(app_error(
            "git_detached_head",
            "Cette action nécessite une branche active, pas un HEAD détaché.",
        ));
    }

    let message = match action.as_str() {
        "fetch" => {
            git_network_action(&root, &["fetch", "--no-tags", "origin"]).await?;
            "Références distantes actualisées ; les fichiers locaux n'ont pas été modifiés."
        }
        "pull" => {
            let status = git_read(
                &root,
                &["status", "--porcelain=v1", "--untracked-files=all"],
            )
            .await?;
            require_clean_worktree(&status)?;
            let upstream = git_read(
                &root,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ],
            )
            .await?;
            let target = upstream_branch(&upstream).ok_or_else(|| {
                app_error(
                    "git_upstream",
                    "Pull refusé : configurez une branche de suivi origin.",
                )
            })?;
            git_network_action(
                &root,
                &[
                    "pull",
                    "--ff-only",
                    "--no-rebase",
                    "--no-autostash",
                    "origin",
                    target,
                ],
            )
            .await?;
            "Mise à jour rapide appliquée ; aucun merge commit ni résolution automatique."
        }
        "push" => {
            let upstream = git_read(
                &root,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ],
            )
            .await?;
            let target = upstream_branch(&upstream).ok_or_else(|| {
                app_error(
                    "git_upstream",
                    "Push refusé : configurez une branche de suivi origin.",
                )
            })?;
            git_network_action(&root, &["fetch", "--no-tags", "origin"]).await?;
            let remote_ahead = git_read(
                &root,
                &["rev-list", "--count", &format!("HEAD..origin/{target}")],
            )
            .await?
            .parse::<u64>()
            .unwrap_or(u64::MAX);
            if remote_ahead > 0 {
                return Err(app_error(
                    "git_remote_ahead",
                    "Push refusé : origin contient des commits absents localement. Récupérez-les d'abord.",
                ));
            }
            let local_ahead = git_read(
                &root,
                &["rev-list", "--count", &format!("origin/{target}..HEAD")],
            )
            .await?
            .parse::<u64>()
            .unwrap_or(0);
            if local_ahead == 0 {
                "Aucun commit local en attente d'envoi."
            } else {
                let refspec = format!("HEAD:refs/heads/{target}");
                git_network_action(&root, &["push", "origin", &refspec]).await?;
                "Commits locaux envoyés sur la branche suivie, sans force push."
            }
        }
        _ => unreachable!("action validated above"),
    };
    Ok(GitMutationResult {
        action,
        branch,
        message: message.to_owned(),
    })
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

    #[test]
    fn parses_only_supported_github_remote_forms() {
        for remote in [
            "https://github.com/Mesrine67/hebergtonserv-desktop.git",
            "git@github.com:Mesrine67/hebergtonserv-desktop.git",
            "ssh://git@github.com/Mesrine67/hebergtonserv-desktop.git",
        ] {
            assert_eq!(
                parse_github_repository(remote).unwrap(),
                "Mesrine67/hebergtonserv-desktop"
            );
        }
    }

    #[test]
    fn rejects_remotes_with_credentials_or_unapproved_hosts() {
        for remote in [
            "https://user:secret@github.com/Mesrine67/repo.git",
            "https://github.example/Mesrine67/repo.git",
            "file:///private/repo.git",
            "git@evil.example:owner/repo.git",
        ] {
            assert!(parse_github_repository(remote).is_err());
        }
    }

    #[test]
    fn refuses_untrusted_github_result_links() {
        let entry: GhEntry = serde_json::from_value(serde_json::json!({
            "number": 1,
            "title": "fixture",
            "state": "OPEN",
            "url": "https://attacker.example/path"
        }))
        .unwrap();
        assert!(validate_github_entry(entry, false).is_err());
    }

    #[test]
    fn detects_issues_disabled_without_exposing_command_output() {
        assert!(issues_disabled(
            b"GraphQL: The acme/private repository has disabled issues (repository.issue)"
        ));
        assert!(!issues_disabled(b"authentication failed"));
    }

    #[test]
    fn only_accepts_origin_branch_upstreams_for_mutating_actions() {
        assert_eq!(upstream_branch("origin/main"), Some("main"));
        assert_eq!(
            upstream_branch("origin/feature/topic"),
            Some("feature/topic")
        );
        assert_eq!(upstream_branch("fork/main"), None);
        assert_eq!(upstream_branch("origin/"), None);
        assert_eq!(upstream_branch("main"), None);
    }

    #[test]
    fn pull_guard_refuses_tracked_and_untracked_changes() {
        assert!(require_clean_worktree("").is_ok());
        assert_eq!(
            require_clean_worktree(" M tracked.txt").unwrap_err().code(),
            "git_worktree_dirty"
        );
        assert_eq!(
            require_clean_worktree("?? private.txt").unwrap_err().code(),
            "git_worktree_dirty"
        );
    }

    #[test]
    fn parses_gh_pull_request_and_issue_json_fixtures() {
        let prs: Vec<GhEntry> = serde_json::from_value(serde_json::json!([{
            "number": 42,
            "title": "Fixture PR",
            "state": "OPEN",
            "url": "https://github.com/owner/repo/pull/42",
            "updatedAt": "2026-11-03T00:00:00Z",
            "headRefName": "feature/test",
            "baseRefName": "main"
        }]))
        .unwrap();
        let pr = validate_github_entry(prs.into_iter().next().unwrap(), true).unwrap();
        assert_eq!(pr.number, 42);
        assert_eq!(pr.head_branch.as_deref(), Some("feature/test"));
        assert_eq!(pr.base_branch.as_deref(), Some("main"));

        let issues: Vec<GhEntry> = serde_json::from_value(serde_json::json!([{
            "number": 7,
            "title": "Fixture issue",
            "state": "OPEN",
            "url": "https://github.com/owner/repo/issues/7",
            "updatedAt": "2026-11-03T00:00:00Z",
            "labels": [{"name": "api"}]
        }]))
        .unwrap();
        let issue = validate_github_entry(issues.into_iter().next().unwrap(), false).unwrap();
        assert_eq!(issue.labels, ["api"]);
        assert_eq!(issue.head_branch, None);
    }

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

    #[tokio::test]
    async fn temporary_remote_supports_fetch_fast_forward_pull_and_push() {
        if tool_output("git", &["--version"], None).await.is_err() {
            return;
        }
        let temp = tempfile::tempdir().unwrap();
        let remote = temp.path().join("remote.git");
        let local = temp.path().join("local");
        let other = temp.path().join("other");
        std::fs::create_dir_all(&local).unwrap();

        async fn git_ok(cwd: &Path, args: &[&str]) {
            let output = Command::new("git")
                .args(args)
                .current_dir(cwd)
                .env("GIT_CONFIG_GLOBAL", "NUL")
                .env("GIT_CONFIG_SYSTEM", "NUL")
                .env("GIT_TERMINAL_PROMPT", "0")
                .output()
                .await
                .unwrap();
            assert!(
                output.status.success(),
                "git {:?} failed with exit status {:?}",
                args,
                output.status.code()
            );
        }

        let output = Command::new("git")
            .args(["init", "--bare", "-q"])
            .arg(&remote)
            .output()
            .await
            .unwrap();
        assert!(output.status.success());
        git_ok(&local, &["init", "-q"]).await;
        git_ok(&local, &["config", "user.name", "Fixture"]).await;
        git_ok(&local, &["config", "user.email", "fixture@example.invalid"]).await;
        std::fs::write(local.join("base.txt"), "base\n").unwrap();
        git_ok(&local, &["add", "base.txt"]).await;
        git_ok(&local, &["commit", "-qm", "base"]).await;
        git_ok(&local, &["branch", "-M", "main"]).await;
        git_ok(
            &local,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        )
        .await;
        git_ok(&local, &["push", "-u", "origin", "main"]).await;

        git_network_action(&local, &["fetch", "--no-tags", "origin"])
            .await
            .unwrap();
        let output = Command::new("git")
            .args(["clone", "-q"])
            .arg(&remote)
            .arg(&other)
            .output()
            .await
            .unwrap();
        assert!(output.status.success());
        git_ok(&other, &["switch", "main"]).await;
        git_ok(&other, &["config", "user.name", "Fixture"]).await;
        git_ok(&other, &["config", "user.email", "fixture@example.invalid"]).await;
        std::fs::write(other.join("remote.txt"), "remote\n").unwrap();
        git_ok(&other, &["add", "remote.txt"]).await;
        git_ok(&other, &["commit", "-qm", "remote change"]).await;
        git_ok(&other, &["push", "origin", "main"]).await;

        git_network_action(
            &local,
            &[
                "pull",
                "--ff-only",
                "--no-rebase",
                "--no-autostash",
                "origin",
                "main",
            ],
        )
        .await
        .unwrap();
        assert_eq!(
            std::fs::read_to_string(local.join("remote.txt"))
                .unwrap()
                .trim_end(),
            "remote"
        );

        std::fs::write(local.join("local.txt"), "local\n").unwrap();
        git_ok(&local, &["add", "local.txt"]).await;
        git_ok(&local, &["commit", "-qm", "local change"]).await;
        git_network_action(&local, &["push", "origin", "HEAD:refs/heads/main"])
            .await
            .unwrap();
        let output = Command::new("git")
            .args(["--git-dir"])
            .arg(&remote)
            .args(["show", "main:local.txt"])
            .output()
            .await
            .unwrap();
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim_end(), "local");
    }
}
