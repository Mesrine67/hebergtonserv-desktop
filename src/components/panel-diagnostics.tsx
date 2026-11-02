import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Clipboard, Download, FileText, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface DiagnosticEntry {
  timestamp: string;
  level: "info" | "warning" | "error";
  operation: string;
  code: string;
  message: string;
}
export function formatDiagnosticEntries(entries: DiagnosticEntry[]) {
  return ["# HébergTonServ Desktop — Diagnostic API (sans secrets)", ...entries.map(e =>
    `${e.timestamp} [${e.level}] ${e.operation} ${e.code}: ${e.message}`
  )].join("\n") + "\n";
}
export function PanelDiagnostics({open, onOpenChange}: {open:boolean;onOpenChange:(open:boolean)=>void}) {
  const [entries,setEntries]=useState<DiagnosticEntry[]>([]);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [filter,setFilter]=useState("");
  const [severity,setSeverity]=useState("all");
  const refresh=useCallback(async()=>{
    if(!isTauri())return;
    try {setEntries(await invoke<DiagnosticEntry[]>("list_panel_diagnostics"));setFeedback("");}
    catch {setFeedback("Lecture du journal indisponible.");}
  },[]);
  useEffect(()=>{if(!open)return;void refresh();const t=window.setInterval(()=>void refresh(),12000);return()=>window.clearInterval(t);},[open,refresh]);
  const shown=useMemo(()=>entries.filter(e=>(severity==="all"||e.level===severity)&&`${e.operation} ${e.code} ${e.message}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())),[entries,filter,severity]);
  const content=useMemo(()=>formatDiagnosticEntries(shown),[shown]);
  async function copy(){
    try {if(isTauri()) await writeText(content);else await navigator.clipboard.writeText(content);setFeedback("Journal copié.");}
    catch {setFeedback("Copie indisponible.");}
  }
  async function exportFile(){
    if(!isTauri())return;
    setBusy(true);
    try {
      const path=await save({title:"Exporter le journal de diagnostic",defaultPath:"hebergtonserv-diagnostic.txt",filters:[{name:"Journal texte",extensions:["txt","log"]}]});
      if(path){await invoke("export_panel_diagnostics",{path});setFeedback("Journal enregistré.");}
    }catch{setFeedback("Enregistrement impossible.");}
    finally{setBusy(false);}
  }
  async function clear(){
    if(!isTauri())return;
    setBusy(true);
    try {await invoke("clear_panel_diagnostics");await refresh();setFeedback("Journal vidé.");}
    catch {setFeedback("Suppression impossible.");}
    finally{setBusy(false);}
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="z-[10025] flex h-[min(85vh,820px)] w-[min(94vw,1200px)] max-w-none flex-col gap-3 overflow-hidden bg-card p-0 sm:max-w-none">
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle className="flex items-center gap-2"><FileText className="size-4 text-primary"/>Journal des API</DialogTitle>
        <DialogDescription>Diagnostics anonymisés des appels WISP/Pterodactyl. Aucune clé API, URL, adresse ni nom de serveur n'est enregistré.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2 px-4">
        <Button size="sm" variant="outline" onClick={()=>void refresh()}><RefreshCw className="size-4"/> Actualiser</Button>
        <Button size="sm" variant="outline" onClick={()=>void copy()}><Clipboard className="size-4"/> Copier</Button>
        <Button size="sm" variant="outline" disabled={busy || !isTauri()} onClick={()=>void exportFile()}><Download className="size-4"/> Enregistrer</Button>
        <Button size="sm" variant="outline" disabled={busy || !entries.length} onClick={()=>void clear()}><Trash2 className="size-4"/> Vider</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4"><Input className="max-w-sm" placeholder="Filtrer les événements…" aria-label="Filtrer les journaux" value={filter} onChange={e=>setFilter(e.target.value)}/><select className="rounded-md border bg-background px-3 py-2 text-xs" aria-label="Niveau des événements" value={severity} onChange={e=>setSeverity(e.target.value)}><option value="all">Tous les niveaux</option><option value="info">Informations</option><option value="warning">Avertissements</option><option value="error">Erreurs</option></select><span className="text-xs text-muted-foreground">{shown.length} / {entries.length} événements</span></div>
      {feedback&&<p className="px-4 text-xs text-muted-foreground" role="status">{feedback}</p>}
      <div className="min-h-0 flex-1 overflow-auto bg-background/70 px-4 pb-5 font-mono">
        {shown.length===0?<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune entrée. Actualisez les serveurs pour collecter des diagnostics.</p>:<div className="divide-y divide-border/60 rounded-md border">
          {[...shown].reverse().map((entry,i)=><div key={`${entry.timestamp}-${i}`} className="grid gap-1 px-3 py-2 text-xs hover:bg-muted/40 md:grid-cols-[180px_75px_1fr]">
            <div className="flex flex-wrap gap-2 md:contents">
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString("fr-FR")}</span>
              <span className={entry.level==="error"?"text-destructive":entry.level==="warning"?"text-amber-500":"text-primary"}>{entry.level}</span>
            </div>
            <p className="font-semibold">{entry.operation} · {entry.code} — <span className="font-normal text-muted-foreground">{entry.message}</span></p>

          </div>)}</div>}
      </div>
      <p className="border-t px-4 py-3 text-[11px] text-muted-foreground">Historique volatile limité à 300 entrées, perdu à la fermeture complète de l'application.</p>
    </DialogContent>
  </Dialog>;
}
