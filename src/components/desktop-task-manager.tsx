import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Activity, Cpu, HardDrive, RefreshCw, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/error-message";

type Task = { pid: number; name: string; memory_kib: number };
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** A single in-app dialog: no secondary WebView2 process or blank window. */
export function DesktopTaskManager() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    if (!isTauri() || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const data = await invoke<Task[]>("list_desktop_tasks");
      setItems(data);
      setError("");
    } catch (reason) {
      setError(errorMessage(reason));
      void invoke("record_app_event", { source: "windows", code: "task_snapshot_failed" }).catch(() => undefined);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("hts:open-task-manager", show);
    let inactive = false;
    let cleanup: (() => void) | undefined;
    if (isTauri()) {
      void listen("hts:open-task-manager", show).then(unlisten => {
        if (inactive) unlisten();
        else cleanup = unlisten;
      }).catch(() => undefined);
    }
    return () => {
      inactive = true;
      cleanup?.();
      window.removeEventListener("hts:open-task-manager", show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void invoke("record_app_event", { source: "windows", code: "task_manager_opened" }).catch(() => undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  const filtered = useMemo(() => items.filter(x =>
    (x.name + " " + x.pid).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [items, query]);
  const memory = items.reduce((total, task) => total + task.memory_kib, 0);

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="z-[10025] flex h-[min(84vh,780px)] w-[min(94vw,1050px)] max-w-none flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-none">
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-base"><Cpu className="size-5 text-primary" /> Gestionnaire de tâches</DialogTitle>
        <DialogDescription>Processus Windows en lecture seule. Actualisation automatique toutes les 15 secondes, sans bloquer l'interface.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-5 py-3">
        <label className="relative min-w-44 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Rechercher par nom ou PID</span>
          <Input placeholder="Nom du processus ou PID…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
        </label>
        <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"><Activity className="size-4 text-primary" /> <span>{fmt.format(items.length)} processus</span></div>
        <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"><HardDrive className="size-4 text-primary" /> <span>{fmt.format(memory / 1024)} Mio</span></div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}><RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")} />Actualiser</Button>
      </div>
      {error && <div role="alert" className="mx-5 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</div>}
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-secondary text-muted-foreground"><tr>
              <th className="px-4 py-3 font-medium">Processus</th>
              <th className="px-4 py-3 font-medium">PID</th>
              <th className="px-4 py-3 text-right font-medium">Mémoire</th>
            </tr></thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map(task => <tr key={task.pid} className="hover:bg-muted/40">
                <td className="max-w-72 truncate px-4 py-2.5 font-medium">{task.name}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">{task.pid}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmt.format(task.memory_kib / 1024)} Mio</td>
              </tr>)}
            </tbody>
          </table>
          {!filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">{busy ? "Chargement des processus…" : "Aucun résultat."}</p>}
        </div>
      </div>
      <footer className="border-t px-5 py-3 text-[11px] text-muted-foreground">Les processus ne peuvent pas être arrêtés depuis ce gestionnaire. Aucune permission d'administration n'est nécessaire.</footer>
    </DialogContent>
  </Dialog>;
}
