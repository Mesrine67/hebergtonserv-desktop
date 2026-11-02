import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Clipboard, Download, FileText, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  const refresh=useCallback(async()=>{
    if(!isTauri())return;
    try {setEntries(await invoke<DiagnosticEntry[]>("list_panel_diagnostics"));setFeedback("");}
    catch {setFeedback("Lecture du journal indisponible.");}
  },[]);
  useEffect(()=>{if(!open)return;void refresh();const t=window.setInterval(()=>void refresh(),12000);return()=>window.clearInterval(t);},[open,refresh]);
  const content=useMemo(()=>formatDiagnosticEntries(entries),[entries]);
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
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="z-[10025] flex w-full flex-col bg-card sm:max-w-[600px]">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><FileText className="size-4 text-primary"/>Journal des API</SheetTitle>
        <SheetDescription>Diagnostics anonymisés des appels WISP/Pterodactyl. Aucune clé API, URL, adresse ni nom de serveur n'est enregistré.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-wrap gap-2 px-4">
        <Button size="sm" variant="outline" onClick={()=>void refresh()}><RefreshCw className="size-4"/> Actualiser</Button>
        <Button size="sm" variant="outline" onClick={()=>void copy()}><Clipboard className="size-4"/> Copier</Button>
        <Button size="sm" variant="outline" disabled={busy || !isTauri()} onClick={()=>void exportFile()}><Download className="size-4"/> Enregistrer</Button>
        <Button size="sm" variant="outline" disabled={busy || !entries.length} onClick={()=>void clear()}><Trash2 className="size-4"/> Vider</Button>
      </div>
      {feedback&&<p className="px-4 text-xs text-muted-foreground" role="status">{feedback}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        {entries.length===0?<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune entrée. Actualisez les serveurs pour collecter des diagnostics.</p>:<div className="space-y-2">
          {[...entries].reverse().map((entry,i)=><div key={`${entry.timestamp}-${i}`} className="rounded-lg border bg-background p-3 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString("fr-FR")}</span>
              <span className={entry.level==="error"?"text-destructive":entry.level==="warning"?"text-amber-500":"text-primary"}>{entry.level}</span>
            </div>
            <p className="mt-1 font-semibold">{entry.operation} · {entry.code}</p>
            <p className="mt-1 text-muted-foreground">{entry.message}</p>
          </div>)}</div>}
      </div>
      <p className="border-t px-4 py-3 text-[11px] text-muted-foreground">Historique volatile limité à 300 entrées, perdu à la fermeture complète de l'application.</p>
    </SheetContent>
  </Sheet>;
}
