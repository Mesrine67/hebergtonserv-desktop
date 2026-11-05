import { useEffect, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BookOpen, CalendarClock, Command, ExternalLink, History, RefreshCw } from "lucide-react";
import { version as buildVersion } from "../../package.json";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordAppEvent } from "@/lib/app-diagnostics";

type Release = { tag_name: string; name: string; body: string; published_at: string | null; html_url: string };
const shortcuts = [
  { title: "Revenir à la page précédente", keys: "Alt + ←" },
  { title: "Aller à la page suivante", keys: "Alt + →" },
  { title: "Afficher / masquer la navigation", keys: "Ctrl + B" },
  { title: "Afficher les raccourcis", keys: "Ctrl + /" },
  { title: "Rechercher des mises à jour", keys: "Aide → Mises à jour" },
  { title: "Ouvrir le gestionnaire de tâches", keys: "Aide → Gestionnaire de tâches" },
] as const;
const fallback: Release = {
  tag_name: `v${buildVersion}`,
  name: `HébergTonServ Desktop v${buildVersion}`,
  published_at: null,
  html_url: `https://github.com/Mesrine67/hebergtonserv-desktop/releases/tag/v${buildVersion}`,
  body: "Consultez les notes de publication pour les nouveautés de cette version de HébergTonServ Desktop.",
};

function ReleaseNotes({ body }: { body: string }) {
  const inline = (value: string) => value.split(/(\*\*[^*]+\*\*)/g).map((chunk, index) =>
    chunk.startsWith("**") && chunk.endsWith("**")
      ? <strong key={index} className="text-foreground">{chunk.slice(2, -2)}</strong>
      : chunk,
  );
  return <div className="space-y-2 py-3 text-[13px] leading-6 text-muted-foreground">{body.replace(/\r\n/g, "\n").split("\n").map((line, index) => {
    const value = line.trim();
    if (!value) return <div key={index} className="h-1" />;
    if (value.startsWith("#")) return <h3 key={index} className="mt-4 font-semibold text-foreground">{inline(value.replace(/^#+\s*/, ""))}</h3>;
    if (value.startsWith("- ") || value.startsWith("* ")) return <p key={index} className="flex gap-2"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" /><span>{inline(value.slice(2))}</span></p>;
    return <p key={index} className="break-words">{inline(value)}</p>;
  })}</div>;
}

export function DesktopHelpPanels() {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const openChangelog = () => {
      setChangelogOpen(true);
      recordAppEvent("help", "changelog_opened");
    };
    const openShortcuts = () => {
      setShortcutsOpen(true);
      recordAppEvent("help", "shortcuts_opened");
    };
    function keyboard(event: KeyboardEvent) {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,[contenteditable=true]")) return;
      event.preventDefault();
      openShortcuts();
    }
    window.addEventListener("hts:open-changelog", openChangelog);
    window.addEventListener("hts:open-shortcuts", openShortcuts);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("hts:open-changelog", openChangelog);
      window.removeEventListener("hts:open-shortcuts", openShortcuts);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  useEffect(() => {
    if (!changelogOpen) return;
    let active = true;
    setLoading(true);
    setError("");
    if (!isTauri()) {
      setReleases([fallback]);
      setLoading(false);
      return;
    }
    void invoke<Release[]>("fetch_changelog")
      .then(data => {
        if (active) {
          setReleases(data.length ? data : [fallback]);
          recordAppEvent("help", "changelog_loaded");
        }
      })
      .catch(() => {
        if (active) {
          setError("Historique en ligne indisponible.");
          setReleases([fallback]);
          recordAppEvent("help", "changelog_failed");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [changelogOpen]);

  const selectedRelease = releases.find(release => release.tag_name === selectedTag) ?? releases[0] ?? fallback;
  function openRelease(url: string) {
    if (!url.startsWith("https://github.com/Mesrine67/hebergtonserv-desktop/releases/")) return;
    if (isTauri()) void openUrl(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  return <>
    <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
      <DialogContent className="flex h-[min(85vh,780px)] w-[min(94vw,1000px)] max-w-none flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle className="flex items-center gap-2"><History className="size-4 text-primary" /> Nouveautés et changelog</DialogTitle>
          <DialogDescription>Notes de version de HébergTonServ Desktop · version installée {buildVersion}.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-36 shrink-0 flex-col border-r bg-sidebar sm:w-48" aria-label="Versions publiées">
            <p className="px-4 pb-2 pt-4 text-[10px] font-semibold uppercase text-muted-foreground">Versions</p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
              {(releases.length ? releases : [fallback]).map(release => <button key={release.tag_name}
                onClick={() => setSelectedTag(release.tag_name)}
                className={`w-full rounded-md border px-3 py-2 text-left text-xs hover:bg-accent ${selectedRelease.tag_name === release.tag_name ? "border-primary/30 bg-primary/10" : "border-transparent"}`}>
                {release.tag_name}
              </button>)}
            </div>
          </aside>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-5">
            {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> Chargement des releases…</p>}
            {error && <p role="status" className="rounded-md border border-amber-500/30 p-3 text-xs text-muted-foreground">{error} La dernière note intégrée reste accessible.</p>}
            <article className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{selectedRelease.name || selectedRelease.tag_name}</h3>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{selectedRelease.tag_name}</span>
              </div>
              {selectedRelease.published_at && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock className="size-3" /> {new Date(selectedRelease.published_at).toLocaleDateString("fr-FR")}</p>}
              <ReleaseNotes body={selectedRelease.body || "Aucune note fournie."} />
              <Button className="mt-3" size="sm" variant="outline" onClick={() => openRelease(selectedRelease.html_url)}><ExternalLink data-icon="inline-start" /> Voir sur GitHub</Button>
            </article>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="w-[min(94vw,650px)] max-w-none bg-card sm:max-w-none">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2"><Command className="size-4 text-primary" /> Raccourcis clavier</DialogTitle>
          <DialogDescription>Actions disponibles dans l’application.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto py-2">
          {shortcuts.map(item => <div key={item.title} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3">
            <span className="text-xs">{item.title}</span>
            <kbd className="shrink-0 rounded border border-border bg-secondary px-2 py-1 font-mono text-[11px]">{item.keys}</kbd>
          </div>)}
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 size-4 shrink-0" /> Les raccourcis indisponibles dans votre contexte sont ignorés. Les commandes de Windows restent gérées par le système.</p>
      </DialogContent>
    </Dialog>
  </>;
}
