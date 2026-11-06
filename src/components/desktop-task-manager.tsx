import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Activity, ArrowDownAZ, ArrowDownWideNarrow, ArrowUpWideNarrow, Copy, Cpu, HardDrive, RefreshCw, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/error-message";

type Task = { pid: number; name: string; cpu_percent: number | null; memory_kib: number; session_name: string; session_number: string };
type SortKey = "cpu" | "memory" | "name" | "pid" | "session";
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const mib = (value: number) => `${fmt.format(value / 1024)} Mio`;

/** Read-only process monitor: no secondary WebView or arbitrary termination command. */
export function DesktopTaskManager() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [descending, setDescending] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState("15");
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    if (!isTauri() || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const data = await invoke<Task[]>("list_desktop_tasks");
      setItems(data);
      setLastRefresh(new Date().toISOString());
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
    const timer = window.setInterval(() => void refresh(), Number(intervalSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [open, refresh, intervalSeconds]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = items.filter(task => `${task.name} ${task.pid} ${task.session_name} ${task.session_number}`.toLocaleLowerCase().includes(needle));
    result.sort((left, right) => {
      let order = 0;
      if (sortKey === "memory") order = left.memory_kib - right.memory_kib;
      else if (sortKey === "cpu") order = (left.cpu_percent ?? -1) - (right.cpu_percent ?? -1);
      else if (sortKey === "pid") order = left.pid - right.pid;
      else if (sortKey === "session") order = `${left.session_name} ${left.session_number}`.localeCompare(`${right.session_name} ${right.session_number}`, "fr", { numeric: true, sensitivity: "base" });
      else order = left.name.localeCompare(right.name, "fr", { numeric: true, sensitivity: "base" });
      return order * (descending ? -1 : 1);
    });
    return result;
  }, [items, query, sortKey, descending]);
  const totalMemory = items.reduce((total, task) => total + task.memory_kib, 0);
  const cpuMeasured = items.filter(task => task.cpu_percent !== null);
  const totalProcessCpu = cpuMeasured.length ? cpuMeasured.reduce((total, task) => total + (task.cpu_percent ?? 0), 0) : null;
  const sessionCount = new Set(items.map(task => `${task.session_name}:${task.session_number}`)).size;
  const topProcesses = [...items].sort((a, b) => b.memory_kib - a.memory_kib).slice(0, 5);
  const maxMemory = topProcesses[0]?.memory_kib ?? 1;
  const selected = items.find(task => task.pid === selectedPid);

  function changeSort(key: SortKey) {
    if (key === sortKey) setDescending(value => !value);
    else { setSortKey(key); setDescending(key === "memory"); }
  }
  async function copyCsv() {
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [
      ["Processus", "PID", "CPU (%)", "Mémoire (Kio)", "Session", "ID de session"].map(quote).join(";"),
      ...filtered.map(task => [task.name, task.pid, task.cpu_percent ?? "", task.memory_kib, task.session_name, task.session_number].map(quote).join(";")),
    ].join("\r\n");
    try {
      if (isTauri()) await writeText(csv);
      else await navigator.clipboard.writeText(csv);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="flex h-[min(88vh,850px)] w-[min(96vw,1180px)] max-w-none flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-none">
      <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-14">
        <DialogTitle className="flex items-center gap-2 text-base"><Cpu className="size-5 text-primary" /> Gestionnaire de tâches</DialogTitle>
        <DialogDescription>Vue Windows en lecture seule avec CPU par processus, mémoire et sessions. Les noms et mesures restent locaux.</DialogDescription>
      </DialogHeader>
      <div className="grid shrink-0 gap-2 border-b border-border bg-muted/20 p-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"><Activity className="size-4 text-primary" /><div><p className="text-[10px] text-muted-foreground">Processus visibles</p><p className="text-sm font-semibold tabular-nums">{fmt.format(filtered.length)} <span className="font-normal text-muted-foreground">/ {fmt.format(items.length)}</span></p></div></div>
        <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"><HardDrive className="size-4 text-primary" /><div><p className="text-[10px] text-muted-foreground">Mémoire recensée</p><p className="text-sm font-semibold tabular-nums">{mib(totalMemory)}</p></div></div>
        <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"><Cpu className="size-4 text-primary" /><div><p className="text-[10px] text-muted-foreground">CPU des processus lisibles</p><p className="text-sm font-semibold tabular-nums">{totalProcessCpu === null ? "En attente…" : `${fmt.format(totalProcessCpu)} %`}</p></div></div>
        <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"><Activity className="size-4 text-primary" /><div><p className="text-[10px] text-muted-foreground">Sessions Windows</p><p className="text-sm font-semibold tabular-nums">{fmt.format(sessionCount)}</p></div></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <label className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Rechercher un processus, PID ou session</span>
          <Input placeholder="Filtrer par processus, PID ou session…" value={query} onChange={event => setQuery(event.target.value)} className="pl-9" />
        </label>
        <Select value={sortKey} onValueChange={value => setSortKey(value as SortKey)}>
          <SelectTrigger className="w-40" aria-label="Trier les processus"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cpu">CPU</SelectItem>
            <SelectItem value="memory">Mémoire</SelectItem>
            <SelectItem value="name">Nom</SelectItem>
            <SelectItem value="pid">PID</SelectItem>
            <SelectItem value="session">Session</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" aria-label={descending ? "Ordre décroissant" : "Ordre croissant"} title={descending ? "Ordre décroissant" : "Ordre croissant"} onClick={() => setDescending(value => !value)}>{descending ? <ArrowDownWideNarrow /> : <ArrowUpWideNarrow />}</Button>
        <Select value={intervalSeconds} onValueChange={setIntervalSeconds}>
          <SelectTrigger className="w-36" aria-label="Fréquence d’actualisation"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="5">Toutes les 5 s</SelectItem><SelectItem value="15">Toutes les 15 s</SelectItem><SelectItem value="30">Toutes les 30 s</SelectItem></SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" disabled={busy || !filtered.length} onClick={() => void copyCsv()}><Copy data-icon="inline-start" /> Copier CSV</Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}><RefreshCw data-icon="inline-start" className={busy ? "animate-spin" : undefined} /> Actualiser</Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto px-4 py-3">
          {error && <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive"><span>{error}</span><Button type="button" size="icon" variant="ghost" className="size-6 shrink-0" aria-label="Masquer l’erreur" onClick={() => setError("")}><X /></Button></div>}
          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{query ? `${fmt.format(filtered.length)} résultat(s) pour « ${query} »` : `${fmt.format(items.length)} processus recensés`}</span><span>Rafraîchissement {intervalSeconds} s · {lastRefresh ? `mis à jour ${new Date(lastRefresh).toLocaleTimeString("fr-FR")}` : "aucune capture"}</span></div>
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-secondary text-muted-foreground"><tr>
                <th className="px-3 py-3 font-medium"><button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => changeSort("name")}>Processus <ArrowDownAZ /></button></th>
                <th className="px-3 py-3 font-medium"><button type="button" className="hover:text-foreground" onClick={() => changeSort("pid")}>PID</button></th>
                <th className="px-3 py-3 font-medium"><button type="button" className="hover:text-foreground" onClick={() => changeSort("session")}>Session</button></th>
                <th className="px-3 py-3 text-right font-medium"><button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => changeSort("cpu")}>CPU <ArrowDownWideNarrow /></button></th>
                <th className="px-3 py-3 text-right font-medium"><button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => changeSort("memory")}>Mémoire <ArrowDownWideNarrow /></button></th>
              </tr></thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map(task => <tr key={task.pid} className={selectedPid === task.pid ? "bg-primary/5" : "hover:bg-muted/40"}>
                  <td className="max-w-72 truncate px-3 py-2.5 font-medium"><button type="button" className="max-w-full truncate text-left hover:text-primary" onClick={() => setSelectedPid(value => value === task.pid ? null : task.pid)} aria-expanded={selectedPid === task.pid}>{task.name}</button></td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{task.pid}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{task.session_name} <span className="font-mono">({task.session_number})</span></td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{task.cpu_percent === null ? "—" : `${fmt.format(task.cpu_percent)} %`}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{mib(task.memory_kib)}</td>
                </tr>)}
              </tbody>
            </table>
            {!filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">{busy ? "Chargement des processus…" : "Aucun résultat. Modifiez votre filtre ou actualisez la liste."}</p>}
          </div>
          {selected && <section className="mt-3 rounded-lg border bg-background p-4" aria-label="Détails du processus sélectionné">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{selected.name}</h3><p className="mt-1 text-xs text-muted-foreground">Détails du processus sélectionné</p></div><Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Fermer les détails" onClick={() => setSelectedPid(null)}><X /></Button></div>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-5"><div><dt className="text-muted-foreground">PID</dt><dd className="mt-1 font-mono">{selected.pid}</dd></div><div><dt className="text-muted-foreground">CPU</dt><dd className="mt-1 font-mono">{selected.cpu_percent === null ? "En attente de la prochaine mesure" : `${fmt.format(selected.cpu_percent)} %`}</dd></div><div><dt className="text-muted-foreground">Session</dt><dd className="mt-1">{selected.session_name}</dd></div><div><dt className="text-muted-foreground">ID de session</dt><dd className="mt-1 font-mono">{selected.session_number}</dd></div><div><dt className="text-muted-foreground">Mémoire</dt><dd className="mt-1 font-mono">{mib(selected.memory_kib)}</dd></div></dl>
          </section>}
        </div>
        <aside className="hidden w-60 shrink-0 border-l bg-sidebar/50 p-3 xl:block" aria-label="Processus les plus consommateurs">
          <h3 className="text-xs font-semibold">Top mémoire</h3>
          <p className="mb-4 mt-1 text-[10px] text-muted-foreground">Cinq processus avec le plus de mémoire.</p>
          <div className="flex flex-col gap-3">{topProcesses.map((task, index) => <div key={task.pid} className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-[10px]"><span className="min-w-0 truncate" title={task.name}>{index + 1}. {task.name}</span><span className="shrink-0 font-mono text-muted-foreground">{mib(task.memory_kib)}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, task.memory_kib / maxMemory * 100)}%` }} /></div>
          </div>)}</div>
        </aside>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-[10px] text-muted-foreground">
        <span>Lecture seule · aucune tâche n’est arrêtée.</span>
        <span>{lastRefresh ? `Dernière actualisation : ${new Date(lastRefresh).toLocaleTimeString("fr-FR")}` : "En attente du premier relevé"} · {fmt.format(items.length)} processus</span>
      </footer>
    </DialogContent>
  </Dialog>;
}
