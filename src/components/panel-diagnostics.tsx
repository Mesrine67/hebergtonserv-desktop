import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ChevronDown, ChevronRight, Clipboard, Download, FileText, RefreshCw, Trash2 } from "lucide-react";
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
function diagnosticHint(code: string): string {
  switch (code) {
    case "api_validation_error": return "HTTP 400/422 : paramètres invalides ou état du serveur incompatible (suspension possible). Contrôler les permissions et le statut depuis le panel.";
    case "api_auth_failed": return "HTTP 401 : authentification Client API refusée.";
    case "api_forbidden": return "HTTP 403 : accès interdit, vérifier les droits Client API.";
    case "api_not_found": return "HTTP 404 : serveur ou endpoint introuvable pour cette version du panel.";
    case "api_rate_limited": return "HTTP 429 : limitation du nombre de requêtes.";
    case "api_network": return "Erreur réseau : vérifier la connexion et le certificat TLS.";
    case "batch_partial": return "Au moins une requête de ressources du lot a échoué.";
    case "ws_connect_failed": return "Connexion TLS/WebSocket Wings échouée : vérifier l’URL Wings et son accessibilité.";
    case "ws_auth_failed": return "Authentification Wings refusée : vérifier le jeton éphémère et les permissions de la console.";
    case "ws_closed": return "WebSocket fermé : vérifier la suspension, le réseau et l’état du serveur.";
    case "ws_expired": return "Jeton Wings expiré : une reconnexion doit obtenir un nouveau jeton.";
    case "api_invalid_response": return "Réponse API non compatible avec le contrat attendu : vérifier la version WISP/Pterodactyl.";
    case "api_ok": return "Appel Client API réussi.";
    default: return "Vérifier le statut du panel, les permissions et les journaux du serveur.";
  }
}
export function formatDiagnosticEntries(entries: DiagnosticEntry[]) {
  return ["# HébergTonServ Desktop — Journal global des API (sans secrets)", ...entries.map(e =>
    `${e.timestamp} [${e.level}] ${e.operation} ${e.code}: ${e.message}\n  Diagnostic : ${diagnosticHint(e.code)}`
  )].join("\n") + "\n";
}
export function PanelDiagnostics({open, onOpenChange}: {open:boolean;onOpenChange:(open:boolean)=>void}) {
  const [entries,setEntries]=useState<DiagnosticEntry[]>([]);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [filter,setFilter]=useState("");
  const [severity,setSeverity]=useState("all");
  const [expanded,setExpanded]=useState<string[]>([]);
  const refresh=useCallback(async()=>{
    if(!isTauri())return;
    try {setEntries(await invoke<DiagnosticEntry[]>("list_panel_diagnostics"));setFeedback("");}
    catch {setFeedback("Lecture du journal indisponible.");}
  },[]);
  useEffect(()=>{if(!open)return;void refresh();const t=window.setInterval(()=>void refresh(),12000);return()=>window.clearInterval(t);},[open,refresh]);
  const shown=useMemo(()=>entries.filter(e=>(severity==="all"||e.level===severity)&&`${e.operation} ${e.code} ${e.message}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())),[entries,filter,severity]);
  const content=useMemo(()=>formatDiagnosticEntries(entries),[entries]);
  const toggle=(key:string)=>setExpanded(previous=>previous.includes(key)?previous.filter(x=>x!==key):[...previous,key]);
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
        <DialogDescription>Journal commun des appels WISP, Pterodactyl et des connexions console de HébergTonServ. Aucun jeton, contenu WebSocket, URL ni identifiant de serveur n’est enregistré.</DialogDescription>
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
        {shown.length===0?<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucun événement. Les appels Client API et les connexions console y apparaîtront automatiquement.</p>:<div className="divide-y divide-border/60 rounded-md border">
          {[...shown].reverse().map((entry,i)=><div key={`${entry.timestamp}-${i}`} className="px-3 py-2 text-xs hover:bg-muted/40">
            <button type="button" className="grid w-full items-center gap-2 text-left md:grid-cols-[16px_175px_75px_1fr]" aria-expanded={expanded.includes(`${entry.timestamp}-${i}`)} onClick={()=>toggle(`${entry.timestamp}-${i}`)}>
              {expanded.includes(`${entry.timestamp}-${i}`)?<ChevronDown className="size-3.5"/>:<ChevronRight className="size-3.5"/>}
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString("fr-FR")}</span>
              <span className={entry.level==="error"?"text-destructive":entry.level==="warning"?"text-amber-500":"text-primary"}>{entry.level}</span>
              <p className="font-semibold">{entry.operation} · {entry.code} — <span className="font-normal text-muted-foreground">{entry.message}</span></p>
            </button>
            {expanded.includes(`${entry.timestamp}-${i}`)&&<div className="mt-2 grid gap-1 rounded-md border bg-muted/35 p-3 font-mono text-xs break-all"><p>Date UTC : {entry.timestamp}</p><p>Niveau : {entry.level}</p><p>Opération : {entry.operation}</p><p>Code : {entry.code}</p><p>Résumé : {entry.message}</p><p>Diagnostic probable : {diagnosticHint(entry.code)}</p><p className="text-muted-foreground">Les données privées (jetons, URL, réponses brutes et identifiants) sont volontairement exclues.</p><Button variant="outline" size="sm" className="w-fit" onClick={()=>void (isTauri()?writeText(formatDiagnosticEntries([entry])):navigator.clipboard.writeText(formatDiagnosticEntries([entry])))}>Copier cet événement</Button></div>}

          </div>)}</div>}
      </div>
      <p className="border-t px-4 py-3 text-[11px] text-muted-foreground">Historique volatile de 300 événements maximum, perdu à la fermeture de l’application. Aucune donnée sensible n’est conservée.</p>
    </DialogContent>
  </Dialog>;
}
