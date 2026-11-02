import { useEffect, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { version as buildVersion } from "../../package.json";
import { BookOpen, CalendarClock, Command, ExternalLink, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { openUrl } from "@tauri-apps/plugin-opener";

type Release = { tag_name: string; name: string; body: string; published_at: string | null; html_url: string };
type Panel = "changelog" | "shortcuts" | null;
const shortcuts = [
  { title: "Revenir à la page précédente", keys: "Alt + ←" },
  { title: "Aller à la page suivante", keys: "Alt + →" },
  { title: "Afficher / masquer la navigation", keys: "Ctrl + B" },
  { title: "Afficher les raccourcis", keys: "Ctrl + /" },
  { title: "Rechercher des mises à jour", keys: "Aide → Mises à jour" },
  { title: "Ouvrir le gestionnaire de tâches", keys: "Aide → Gestionnaire de tâches" },
] as const;
const fallback: Release = { tag_name: `v${buildVersion}`, name: `HébergTonServ Desktop v${buildVersion}`, published_at: null, html_url: `https://github.com/Mesrine67/hebergtonserv-desktop/releases/tag/v${buildVersion}`, body: "Consultez les notes de publication pour les nouveautés de cette version de HébergTonServ Desktop." };

export function DesktopHelpPanels() {
  const [panel, setPanel] = useState<Panel>(null);
  const [releases,setReleases] = useState<Release[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  useEffect(()=>{
    const changelog=()=>setPanel("changelog"), shortcuts=()=>setPanel("shortcuts");
    function keyboard(event:KeyboardEvent){
      if(event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key==="/"){
        const target=event.target as HTMLElement | null;
        if (target?.closest("input,textarea,[contenteditable=true]")) return;
        event.preventDefault();setPanel("shortcuts");
      }
    }
    window.addEventListener("hts:open-changelog",changelog);
    window.addEventListener("hts:open-shortcuts",shortcuts);
    window.addEventListener("keydown",keyboard);
    return()=>{window.removeEventListener("hts:open-changelog",changelog);window.removeEventListener("hts:open-shortcuts",shortcuts);window.removeEventListener("keydown",keyboard);};
  },[]);
  useEffect(()=>{
    if(panel!=="changelog")return;
    let active=true;
    setLoading(true);setError("");
    if(!isTauri()){setReleases([fallback]);setLoading(false);return;}
    void invoke<Release[]>("fetch_changelog").then(data=>{if(active)setReleases(data);},e=>{if(active){setError(String(e));setReleases([fallback]);}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[panel]);
  function openRelease(url:string){if(!url.startsWith("https://github.com/Mesrine67/hebergtonserv-desktop/releases/"))return;if(isTauri())void openUrl(url);else window.open(url,"_blank","noopener,noreferrer");}
  return <Sheet open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
    <SheetContent side="right" className="z-[10025] flex w-full max-w-[min(520px,92vw)] flex-col bg-card sm:max-w-[520px]">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">{panel==="changelog"?<History className="size-4 text-primary"/>:<Command className="size-4 text-primary"/>}{panel==="changelog"?"Nouveautés et changelog":"Raccourcis clavier"}</SheetTitle>
        <SheetDescription>{panel==="changelog"?"Historique des versions publiées sur GitHub.":"Commandes disponibles dans l'application."}</SheetDescription>
      </SheetHeader>
      {panel==="changelog"?<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
        {loading&&<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> Chargement des releases…</p>}
        {error&&<p role="status" className="rounded-md border border-amber-500/30 p-3 text-xs text-muted-foreground">Lecture en ligne indisponible. La dernière note intégrée reste accessible.</p>}
        {releases.map(release=><article key={release.tag_name} className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{release.name||release.tag_name}</h3><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{release.tag_name}</span></div>
          {release.published_at&&<p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock className="size-3" /> {new Date(release.published_at).toLocaleDateString("fr-FR")}</p>}
          <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{release.body?.slice(0,3500)||"Aucune note fournie."}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={()=>openRelease(release.html_url)}><ExternalLink className="size-3.5"/> Voir sur GitHub</Button>
        </article>)}
      </div>:<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-2">{shortcuts.map(item=><div key={item.title} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3"><span className="text-xs">{item.title}</span><kbd className="shrink-0 rounded border border-border bg-secondary px-2 py-1 font-mono text-[11px]">{item.keys}</kbd></div>)}</div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 size-4 shrink-0" /> Certains raccourcis appartiennent à Windows. Les nouvelles actions seront documentées lors de leur intégration.</p>
      </div>}
    </SheetContent>
  </Sheet>;
}
