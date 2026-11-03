import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, GitBranch, GitCommitHorizontal, GitPullRequest, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { commands, type GitHubActivity, type GitSnapshot, type GitTools } from "@/lib/tauri";

export default function GitHubPage() {
  const [tools, setTools] = useState<GitTools | null>(null);
  const [root, setRoot] = useState("");
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [activity, setActivity] = useState<GitHubActivity | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState("");
  const selectionVersion = useRef(0);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void commands.getGitTools().then((result) => {
      if (active) setTools(result);
    }).catch(() => {
      if (active) setTools({ git: null, gh: null });
    });
    return () => { active = false; };
  }, []);

  async function inspect(folder: string) {
    setLoading(true);
    setError("");
    setSnapshot(null);
    try {
      setSnapshot(await commands.inspectGitRepository(folder));
    } catch (cause) {
      setError(typeof cause === "object" && cause !== null && "message" in cause
        ? String(cause.message) : "Dépôt inaccessible ou dossier non Git.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseFolder() {
    if (!isTauri()) return;
    try {
      const selected = await open({ directory: true, multiple: false, title: "Sélectionner un dépôt Git local" });
      if (typeof selected !== "string") return;
      selectionVersion.current += 1;
      setGithubLoading(false);
      setRoot(selected);
      setActivity(null);
      setGithubError("");
      await inspect(selected);
    } catch {
      setError("Impossible d'ouvrir le sélecteur de dossiers.");
    }
  }

  async function loadGitHubActivity() {
    if (!root || !isTauri()) return;
    const requestVersion = ++selectionVersion.current;
    setGithubLoading(true);
    setGithubError("");
    setActivity(null);
    try {
      const result = await commands.getGitHubActivity(root);
      if (requestVersion === selectionVersion.current) setActivity(result);
    } catch (cause) {
      if (requestVersion === selectionVersion.current) {
        setGithubError(typeof cause === "object" && cause !== null && "message" in cause
          ? String(cause.message) : "Impossible de lire les informations GitHub.");
      }
    } finally {
      if (requestVersion === selectionVersion.current) setGithubLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Développement" title="Git / GitHub"
        description="Consultez vos dépôts locaux en lecture seule, uniquement après avoir choisi un dossier." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard title="Git local" description="Branches, fichiers suivis modifiés et derniers commits."
          action={<Button type="button" size="sm" variant="outline" onClick={() => void chooseFolder()} disabled={!isTauri() || loading}>
            <FolderOpen className="mr-2 size-4" /> Choisir un dossier
          </Button>}>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0" />
              <span>Git : {tools === null ? "Détection…" : tools.git ?? "Non installé"}</span>
            </div>
            <p className="break-all text-xs text-muted-foreground">{root || "Aucun dépôt sélectionné. L'application ne parcourt aucun dossier automatiquement."}</p>
            {root && <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void inspect(root)}>
              <RefreshCw className="mr-2 size-4" /> {loading ? "Analyse…" : "Actualiser"}
            </Button>}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-destructive">{error}</p>}
            {snapshot && (
              <div className="space-y-4">
                <p className="flex items-center gap-2 break-all text-xs"><GitBranch className="size-4 shrink-0 text-primary" />
                  <strong>{snapshot.branch || "HEAD détachée"}</strong><span className="text-muted-foreground">— {snapshot.root}</span>
                </p>
                <div>
                  <h3 className="mb-2 font-medium">Fichiers suivis modifiés (maximum 100)</h3>
                  {snapshot.changes.length
                    ? <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-secondary/30 p-3 font-mono text-xs">
                        {snapshot.changes.map((line, i) => <li key={i} className="break-all">{line}</li>)}
                      </ul>
                    : <p className="text-xs text-muted-foreground">Aucune modification de fichier suivi détectée.</p>}
                  {snapshot.changes_truncated && <p className="mt-1 text-xs text-muted-foreground">Liste tronquée. Ouvrez Git pour le détail.</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Les fichiers non suivis sont volontairement exclus de cet aperçu.</p>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-medium"><GitCommitHorizontal className="size-4" /> Huit derniers commits</h3>
                  {snapshot.commits.length
                    ? <ul className="space-y-2">{snapshot.commits.map((commit) => <li key={commit.hash} className="flex gap-3 text-xs">
                        <code className="shrink-0 text-primary">{commit.hash}</code><span className="min-w-0 break-words">{commit.subject}</span>
                      </li>)}</ul>
                    : <p className="text-xs text-muted-foreground">Aucun commit dans ce dépôt.</p>}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard title="GitHub" description="PR et issues du remote origin, après action explicite.">
          <div className="space-y-4 text-sm">
            <p className="flex items-start gap-2 text-muted-foreground"><GitPullRequest className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{tools?.gh ? `CLI détecté : ${tools.gh}` : "CLI GitHub indisponible ou non détecté."}</span>
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadGitHubActivity()} disabled={!root || !tools?.gh || !isTauri() || githubLoading}>
              <RefreshCw className={`mr-2 size-4 ${githubLoading ? "animate-spin" : ""}`} />{githubLoading ? "Lecture…" : "Charger PR et issues"}
            </Button>
            {githubError && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">{githubError}</p>}
            {activity && <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{activity.repository} · {activity.authenticated ? "gh connecté" : "gh non authentifié"}</p>
              {!activity.authenticated
                ? <p className="text-xs text-muted-foreground">Connectez gh avec <code>gh auth login</code>, puis rechargez. Aucun jeton n'est lu ni affiché par l'application.</p>
                : <>
                  <GitHubList title="Pull requests" entries={activity.pull_requests} />
                  {activity.issues_available
                    ? <GitHubList title="Issues" entries={activity.issues} />
                    : <p className="text-xs text-muted-foreground">Les issues sont désactivées pour ce dépôt GitHub.</p>}
                </>}
            </div>}
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0" />
              Cette lecture explicite utilise l'authentification existante de gh. Elle n'effectue aucun fetch, pull, push ni modification de dépôt.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function GitHubList({ title, entries }: { title: string; entries: GitHubActivity["issues"] }) {
  return <section className="space-y-2">
    <h3 className="font-medium">{title} <span className="text-xs text-muted-foreground">({entries.length})</span></h3>
    {entries.length === 0
      ? <p className="text-xs text-muted-foreground">Aucun élément récent.</p>
      : <ul className="max-h-56 space-y-2 overflow-y-auto">
        {entries.map(entry => <li key={entry.number} className="rounded-lg border p-2.5 text-xs">
          <div className="flex items-start justify-between gap-3"><a className="min-w-0 break-words font-medium hover:underline" href={entry.url} target="_blank" rel="noreferrer">#{entry.number} {entry.title}</a><span className="shrink-0 rounded bg-secondary px-1.5 py-0.5">{entry.state}</span></div>
          {entry.head_branch && <p className="mt-1 break-all text-muted-foreground">{entry.head_branch} → {entry.base_branch}</p>}
          {entry.labels.length > 0 && <p className="mt-1 break-words text-muted-foreground">{entry.labels.join(" · ")}</p>}
          {entry.updated_at && <p className="mt-1 text-muted-foreground">Mis à jour : {new Date(entry.updated_at).toLocaleDateString()}</p>}
        </li>)}
      </ul>}
  </section>;
}
