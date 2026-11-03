import { useEffect, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { version as buildVersion } from "../../package.json";
import { BookOpen, CalendarClock, Command, ExternalLink, History, RefreshCw, Sparkles, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { recordAppEvent } from "@/lib/app-diagnostics";

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

function ReleaseNotes({body}:{body:string}){
  const inline=(value:string)=>value.split(/(\*\*[^*]+\*\*)/g).map((chunk,i)=>chunk.startsWith("**")&&chunk.endsWith("**")?<strong key={i} className="text-foreground">{chunk.slice(2,-2)}</strong>:chunk);
  return <div className="space-y-2 py-3 text-[13px] leading-6 text-muted-foreground">{body.replace(/\r\n/g,"\n").split("\n").map((line,i)=>{
    const v=line.trim();if(!v)return <div key={i} className="h-1"/>;
    if(v.startsWith("#"))return <h3 key={i} className="mt-4 font-semibold text-foreground">{inline(v.replace(/^#+\s*/,""))}</h3>;
    if(v.startsWith("- ")||v.startsWith("* "))return <p key={i} className="flex gap-2"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"/><span>{inline(v.slice(2))}</span></p>;
    return <p key={i} className="break-words">{inline(v)}</p>;
  })}</div>;
}
export function DesktopHelpPanels() {
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedTag, setSelectedTag] = useState("");
  const [releases,setReleases] = useState<Release[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  useEffect(()=>{
    const changelog=()=>{setPanel("changelog");recordAppEvent("help","changelog_opened");}, shortcuts=()=>{setPanel("shortcuts");recordAppEvent("help","shortcuts_opened");};
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
    void invoke<Release[]>("fetch_changelog").then(data=>{if(active){setReleases(data.length?data:[fallback]);recordAppEvent("help","changelog_loaded");}},()=>{if(active){setError("Historique en ligne indisponible.");setReleases([fallback]);recordAppEvent("help","changelog_failed");}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[panel]);
  const selectedRelease = releases.find(r=>r.tag_name===selectedTag) ?? releases[0] ?? fallback;
  function openRelease(url:string){if(!url.startsWith("https://github.com/Mesrine67/hebergtonserv-desktop/releases/"))return;if(isTauri())void openUrl(url);else window.open(url,"_blank","noopener,noreferrer");}
  return <Dialog open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
    <DialogContent className="z-[10025] flex h-[min(85vh,780px)] w-[min(94vw,1000px)] max-w-none flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-none">
      <DialogHeader className="shrink-0 border-b p-5 pr-12">
        <DialogTitle className="flex items-center gap-2">{panel==="changelog"?<History className="size-4 text-primary"/>:<Command className="size-4 text-primary"/>}{panel==="changelog"?"Nouveautés et changelog":"Raccourcis clavier"}</DialogTitle>
        <DialogDescription>{panel==="changelog"?"Historique des versions publiées sur GitHub.":"Commandes disponibles dans l'application."}</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-48 shrink-0 flex-col border-r bg-sidebar md:w-60" aria-label="Navigation du centre d'aide">
          <nav className="space-y-1 border-b p-2">
            <button className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-accent" onClick={()=>setPanel("changelog")}><Sparkles className="mr-2 inline size-4"/>Nouveautés</button>
            <button className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-accent" onClick={()=>setPanel("shortcuts")}><Keyboard className="mr-2 inline size-4"/>Raccourcis</button>
          </nav>
          <p className="px-4 pb-2 pt-4 text-[10px] font-semibold uppercase text-muted-foreground">Versions</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
            {(releases.length?releases:[fallback]).map(r=><button key={r.tag_name} onClick={()=>{setSelectedTag(r.tag_name);setPanel("changelog");}} className={"w-full rounded-md border px-3 py-2 text-left text-xs hover:bg-accent "+(selectedRelease.tag_name===r.tag_name&&panel==="changelog"?"border-primary/30 bg-primary/10":"border-transparent")}>{r.tag_name}</button>)}
          </div>
          <p className="border-t p-3 text-[10px] text-muted-foreground">Installée : {buildVersion}</p>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {panel==="changelog"?<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
        {loading&&<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> Chargement des releases…</p>}
        {error&&<p role="status" className="rounded-md border border-amber-500/30 p-3 text-xs text-muted-foreground">Lecture en ligne indisponible. La dernière note intégrée reste accessible.</p>}
        {[selectedRelease].map(release=><article key={release.tag_name} className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{release.name||release.tag_name}</h3><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{release.tag_name}</span></div>
          {release.published_at&&<p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock className="size-3" /> {new Date(release.published_at).toLocaleDateString("fr-FR")}</p>}
          <ReleaseNotes body={release.body||"Aucune note fournie."} />
          <Button className="mt-3" size="sm" variant="outline" onClick={()=>openRelease(release.html_url)}><ExternalLink className="size-3.5"/> Voir sur GitHub</Button>
        </article>)}
      </div>:<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-2">{shortcuts.map(item=><div key={item.title} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3"><span className="text-xs">{item.title}</span><kbd className="shrink-0 rounded border border-border bg-secondary px-2 py-1 font-mono text-[11px]">{item.keys}</kbd></div>)}</div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 size-4 shrink-0" /> Certains raccourcis appartiennent à Windows. Les nouvelles actions seront documentées lors de leur intégration.</p>
      </div>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
