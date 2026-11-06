import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ThemeProvider } from "next-themes";
import { ThemeStyleProvider } from "@/lib/theme-style";
import { Cpu, HardDrive, Minus, RefreshCw, Search, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Task = {pid:number;name:string;cpu_percent:number|null;memory_kib:number};
const fmt=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1});
function TaskManagerContent(){
 const [items,setItems]=useState<Task[]>([]);
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [maximized,setMaximized]=useState(false);
 const refresh=useCallback(async()=>{
  if(!isTauri())return;
  setLoading(true);setError("");
  try {setItems(await invoke<Task[]>("list_desktop_tasks"));}
  catch(err){setError(String(err));}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>{void refresh();},8000);return()=>window.clearInterval(timer);},[refresh]);
 const filtered=useMemo(()=>items.filter(x=>[x.name,String(x.pid)].join(" ").toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>(b.cpu_percent??-1)-(a.cpu_percent??-1)),[items,query]);
 const sum=items.reduce((t,x)=>t+x.memory_kib,0);
 return <div className="hts-task-window flex h-dvh min-h-0 flex-col bg-background text-foreground">
  <header data-tauri-drag-region className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3">
   <div data-tauri-drag-region className="flex items-center gap-2 text-xs font-semibold"><Cpu className="size-4 text-primary"/> Gestionnaire de tâches <span className="font-normal text-muted-foreground">— HébergTonServ</span></div>
   <div className="flex gap-1">
    <Button variant="ghost" size="icon-sm" aria-label="Réduire" onClick={()=>{if(isTauri())void getCurrentWindow().minimize();}}><Minus className="size-4"/></Button>
    <Button variant="ghost" size="icon-sm" aria-label={maximized?"Restaurer":"Agrandir"} onClick={()=>{if(isTauri())void getCurrentWindow().toggleMaximize().then(()=>setMaximized(v=>!v));}}><Square className="size-3.5"/></Button>
    <Button variant="ghost" size="icon-sm" aria-label="Fermer le gestionnaire" onClick={()=>{if(isTauri())void getCurrentWindow().close();}}><X className="size-4"/></Button>
   </div>
  </header>
  <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
   <div className="mr-auto"><h1 className="text-base font-semibold">Processus Windows</h1><p className="text-xs text-muted-foreground">Vue en lecture seule des tâches en cours, actualisée toutes les 8 secondes.</p></div>
   <Button variant="outline" size="sm" onClick={()=>void refresh()} disabled={loading}><RefreshCw className={`size-3.5 ${loading?"animate-spin":""}`}/> Actualiser</Button>
  </div>
  <div className="flex flex-wrap items-center gap-3 px-5 py-3">
   <label className="relative min-w-52 flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><span className="sr-only">Rechercher un processus</span><Input className="pl-8" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filtrer par nom ou PID..." /></label>
   <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs"><span className="text-muted-foreground">Processus : </span><strong>{items.length}</strong></div>
   <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs"><span className="text-muted-foreground">CPU des processus lisibles : </span><strong>{items.filter(x=>x.cpu_percent!==null).length ? `${fmt.format(items.reduce((sum,x)=>sum+(x.cpu_percent??0),0))} %` : "En attente…"}</strong></div>
   <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs"><HardDrive className="mr-1 inline size-3.5 text-primary"/><strong>{fmt.format(sum/1024)} Mo</strong> <span className="text-muted-foreground">recensés</span></div>
  </div>
  {error&&<p role="alert" className="mx-5 rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
  <div className="mx-5 mb-5 min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
   <table className="w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-secondary text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Processus</th><th className="px-3 py-3 font-medium">PID</th><th className="px-3 py-3 text-right font-medium">CPU</th><th className="px-4 py-3 text-right font-medium">Mémoire</th></tr></thead>
   <tbody className="divide-y divide-border/70">{filtered.map(x=><tr key={x.pid} className="hover:bg-accent/40"><td className="max-w-64 truncate px-4 py-2.5 font-medium">{x.name}</td><td className="px-3 py-2.5 font-mono text-muted-foreground">{x.pid}</td><td className="px-3 py-2.5 text-right tabular-nums">{x.cpu_percent===null?"—":`${fmt.format(x.cpu_percent)} %`}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmt.format(x.memory_kib/1024)} Mo</td></tr>)}</tbody></table>
   {!filtered.length&&<p className="p-8 text-center text-sm text-muted-foreground">Aucun processus correspondant.</p>}
  </div>
  <footer className="flex items-center justify-between border-t border-border px-5 py-2 text-[11px] text-muted-foreground"><span>Lecture seule : aucune tâche ne peut être arrêtée depuis cette fenêtre.</span><span>Windows / Tauri</span></footer>
 </div>;
}
export default function TaskManagerWindow(){
 return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="hts-ui-theme"><ThemeStyleProvider><TaskManagerContent/></ThemeStyleProvider></ThemeProvider>;
}
