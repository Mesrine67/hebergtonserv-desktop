import { useEffect, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BookOpen, CalendarClock, Command, ExternalLink, History, Search, RefreshCw } from "lucide-react";
import { version as buildVersion } from "../../package.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { recordAppEvent } from "@/lib/app-diagnostics";

type Release = { tag_name: string; name: string; body: string; published_at: string | null; html_url: string };
const shortcuts = [
  { group: "Navigation", title: "Revenir à la page précédente", keys: ["Alt", "←"], detail: "Revient à l’écran précédent de l’application." },
  { group: "Navigation", title: "Avancer dans l’historique", keys: ["Alt", "→"], detail: "Rouvre l’écran suivant si vous êtes déjà revenu en arrière." },
  { group: "Navigation", title: "Afficher ou masquer la navigation", keys: ["Ctrl", "B"], detail: "Libère de l’espace pour la page en cours." },
  { group: "Navigation", title: "Rechercher un serveur", keys: ["Ctrl", "K"], detail: "Ouvre la recherche dans la liste des serveurs." },
  { group: "Aide", title: "Afficher les raccourcis", keys: ["Ctrl", "/"], detail: "Ouvre ce panneau. Disponible depuis les pages de l’application." },
  { group: "Dans l’éditeur de fichiers", title: "Enregistrer le fichier", keys: ["Ctrl", "S"], detail: "Enregistre les modifications du fichier actuellement ouvert." },
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [shortcutFilter, setShortcutFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const openShortcuts = () => {
      setShortcutFilter("");
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
    window.addEventListener("hts:open-shortcuts", openShortcuts);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("hts:open-shortcuts", openShortcuts);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  useEffect(() => {
    const openChangelog = () => setChangelogOpen(true);
    window.addEventListener("hts:open-changelog", openChangelog);
    return () => window.removeEventListener("hts:open-changelog", openChangelog);
  }, []);

  useEffect(() => {
    if (!changelogOpen) return;
    setSelectedTag("");
    recordAppEvent("help", "changelog_opened");
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
    <FloatingPanel open={changelogOpen} onOpenChange={setChangelogOpen} title={<span className="flex items-center gap-2"><History className="size-4 text-primary" /> Nouveautés et changelog</span>} description={`Notes de version de HébergTonServ Desktop · version installée ${buildVersion}.`} className="h-[min(85vh,780px)] w-[min(94vw,1000px)]">
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
    </FloatingPanel>

    <FloatingPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} title={<span className="flex items-center gap-2 text-base"><span className="flex size-8 items-center justify-center rounded-lg border bg-primary/10 text-primary"><Command className="size-4" /></span> Raccourcis clavier</span>} description="Retrouvez les commandes disponibles et leur contexte d’utilisation." className="h-[min(82dvh,680px)] w-[min(94vw,700px)]">
        <div className="shrink-0 border-b p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={shortcutFilter} onChange={event => setShortcutFilter(event.target.value)} placeholder="Filtrer les raccourcis…" aria-label="Filtrer les raccourcis clavier" className="h-9 pl-9" />
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">{shortcuts.filter(item => `${item.group} ${item.title} ${item.keys.join(" ")}`.toLocaleLowerCase().includes(shortcutFilter.trim().toLocaleLowerCase())).length} raccourcis affichés</p>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {(["Navigation", "Aide", "Dans l’éditeur de fichiers"] as const).map(group => {
            const entries = shortcuts.filter(item => item.group === group && `${item.group} ${item.title} ${item.keys.join(" ")} ${item.detail}`.toLocaleLowerCase().includes(shortcutFilter.trim().toLocaleLowerCase()));
            if (!entries.length) return null;
            return <section key={group} aria-label={group}>
              <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group}</h3>
              <div className="divide-y overflow-hidden rounded-lg border bg-background">
                {entries.map(item => <div key={item.title} className="flex items-center justify-between gap-4 px-3 py-3 transition-colors hover:bg-muted/35 sm:px-4">
                  <div className="min-w-0"><p className="text-xs font-medium">{item.title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p></div>
                  <div className="flex shrink-0 items-center gap-1" aria-label={item.keys.join(" + ")}>
                    {item.keys.map((key, index) => <span key={`${item.title}-${key}`} className="flex items-center gap-1">
                      {index > 0 && <span aria-hidden="true" className="text-[10px] text-muted-foreground">+</span>}
                      <kbd className="min-w-7 rounded-md border border-border bg-secondary px-2 py-1.5 text-center font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_var(--border)]">{key}</kbd>
                    </span>)}
                  </div>
                </div>)}
              </div>
            </section>;
          })}
          {!shortcuts.some(item => `${item.group} ${item.title} ${item.keys.join(" ")} ${item.detail}`.toLocaleLowerCase().includes(shortcutFilter.trim().toLocaleLowerCase())) && <p className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">Aucun raccourci ne correspond à cette recherche.</p>}
        </div>
        <p className="flex shrink-0 items-start gap-2 border-t px-5 py-3 text-[11px] leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 size-4 shrink-0 text-primary" /> Les raccourcis contextuels ne s’activent que lorsque leur page est ouverte. Les commandes de Windows restent gérées par le système.</p>
    </FloatingPanel>
  </>;
}
