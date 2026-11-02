import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleOff,
  ExternalLink,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  ScrollText,
  Search,
  Server,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/page-shell";
import { PanelDiagnostics } from "@/components/panel-diagnostics";
import { commands, type PanelServer, type PanelServerResources } from "@/lib/tauri";

const PAGE_SIZE = 12;
const RESOURCE_REFRESH_MS = 60_000;

function formatBytes(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 Mio";
  const units = ["o", "Kio", "Mio", "Gio", "Tio"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function memoryBytes(server: PanelServer, resources?: PanelServerResources) {
  return resources?.memory_limit_bytes ?? (server.limits.memory != null && server.limits.memory >= 0
    ? server.limits.memory * 1024 * 1024
    : undefined);
}

function diskBytes(server: PanelServer, resources?: PanelServerResources) {
  return resources?.disk_limit_bytes ?? (server.limits.disk != null && server.limits.disk >= 0
    ? server.limits.disk * 1024 * 1024
    : undefined);
}

function usagePercent(used?: number | null, limit?: number | null) {
  if (used == null || limit == null || limit <= 0) return undefined;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

export function stateFor(server: PanelServer, resources?: PanelServerResources) {
  if (server.suspended || resources?.suspended) return "suspended";
  if (server.installing) return "installing";
  if (server.status?.toLowerCase() === "suspended") return "suspended";
  const state = resources?.state?.toLowerCase() ?? server.status?.toLowerCase();
  if (state && ["running", "online", "started", "1"].includes(state)) return "online";
  if (state && ["offline", "stopped", "stopping", "0", "install_failed"].includes(state)) return "offline";
  if (state && ["starting", "restarting", "installing"].includes(state)) return "starting";
  return "unknown";
}

function stateLabel(state: string) {
  switch (state) {
    case "online": return "En ligne";
    case "offline": return "Arrêté";
    case "suspended": return "Suspendu";
    case "installing": return "Installation";
    case "starting": return "Démarrage";
    default: return "État inconnu";
  }
}

function Stat({
  icon: Icon,
  label,
  value,
  percent,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  percent?: number;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/55 px-3 py-2.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold tabular-nums">{value}</p>
      {percent != null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/80"
          role="progressbar"
          aria-label={`${label} utilisé`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ServerCard({
  server,
  resources: stats,
  loading,
  failed,
  errorCode,
  panelUrl,
}: {
  server: PanelServer;
  panelUrl: string;
  resources?: PanelServerResources;
  loading: boolean;
  failed: boolean;
  errorCode?: string;
}) {
  const state = stateFor(server, stats);
  // The list endpoint can report a suspended server even when its resources endpoint rejects the request.
  const stateText = state === "suspended" ? stateLabel(state) : failed ? "API indisponible" : stateLabel(state);
  const memoryLimit = memoryBytes(server, stats);
  const diskLimit = diskBytes(server, stats);
  const cpuLimit = stats?.cpu_limit_percent ?? server.limits.cpu ?? undefined;
  const cpuPercent = usagePercent(stats?.cpu_percent, cpuLimit);
  const memoryPercent = usagePercent(stats?.memory_used_bytes, memoryLimit);
  const diskPercent = usagePercent(stats?.disk_used_bytes, diskLimit);
  const address = stats?.connect_address ?? server.connect_address;
  const shortId = server.identifier || server.id.slice(0, 8);
  const openConsole = () => {
    try {
      const url = new URL(panelUrl);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
      // The client console uses the short identifier, not the admin numeric ID.
      url.pathname = `/server/${encodeURIComponent(server.identifier)}`;
      url.search = "";
      url.hash = "";
      if (isTauri()) void openUrl(url.toString());
      else window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch { /* Invalid saved panel URL: do not open. */ }
  };

  const stateIcon = state === "online"
    ? <CircleCheck className="size-4 text-emerald-500" aria-hidden="true" />
    : state === "offline" || state === "suspended"
      ? <CircleOff className="size-4 text-muted-foreground" aria-hidden="true" />
      : <CircleAlert className="size-4 text-amber-500" aria-hidden="true" />;

  return (
    <article className="group overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/35">
      <div className="relative border-b bg-gradient-to-br from-primary/[0.09] via-card to-card px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background/70 text-primary shadow-sm">
            <Server className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="max-w-full truncate font-semibold">{server.name}</h2>
              <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {address ? <><span className="font-medium text-foreground/80">{address}</span>{server.node && <> sur {server.node}</>}</> : server.node ?? server.egg ?? "Adresse de connexion indisponible"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border bg-background/75 px-2.5 py-1 text-xs font-medium">
            {stateIcon}
            <span>{stateText}</span>
          </div>
        </div>
        <button type="button" onClick={openConsole} className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Ouvrir la console du serveur ${server.name}`}>
          <ExternalLink className="size-3.5" aria-hidden="true" /> Ouvrir la console
        </button>
        {server.egg && (
          <div className="mt-3 flex items-center gap-2 pl-[52px] text-xs text-muted-foreground">
            <span className="max-w-full truncate rounded-md border bg-background/60 px-2 py-1">{server.egg}</span>
            {server.installing && <span>Installation en cours</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4 sm:p-4">
        <Stat
          icon={Cpu}
          label="CPU"
          value={stats?.cpu_percent != null ? `${stats.cpu_percent.toFixed(1)}${cpuLimit && cpuLimit > 0 ? ` / ${cpuLimit}` : ""} %` : "—"}
          percent={cpuPercent}
        />
        <Stat
          icon={MemoryStick}
          label="Mémoire"
          value={`${formatBytes(stats?.memory_used_bytes)} / ${formatBytes(memoryLimit)}`}
          percent={memoryPercent}
        />
        <Stat
          icon={HardDrive}
          label="Stockage"
          value={`${formatBytes(stats?.disk_used_bytes)} / ${formatBytes(diskLimit)}`}
          percent={diskPercent}
        />
        {stats?.players != null || stats?.max_players != null ? (
          <Stat
            icon={Users}
            label="Joueurs"
            value={`${stats.players ?? 0} / ${stats.max_players ?? "—"}`}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/55 px-3 py-2.5 text-muted-foreground">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate text-xs">{failed ? "Stats indisponibles" : loading ? "Chargement…" : "Jeu sans requête"}</span>
          </div>
        )}
      </div>
      {stats && (stats.network_rx_bytes != null || stats.network_tx_bytes != null) && (
        <p className="px-4 pb-3 text-xs text-muted-foreground tabular-nums">
          Réseau : ↓ {formatBytes(stats.network_rx_bytes)} · ↑ {formatBytes(stats.network_tx_bytes)}
        </p>
      )}
      {failed && (
        <p className="border-t px-4 py-2 text-xs text-amber-500" role="status">
          Ressources indisponibles ({errorCode ?? "api_network"}). Consultez le journal API pour diagnostiquer les autorisations, la version et les limites de requêtes.
        </p>
      )}
    </article>
  );
}

export default function PanelServersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showLogs, setShowLogs] = useState(false);
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = panels.data?.find((item) => item.status === "ok") ?? panels.data?.[0];
  const servers = useQuery({
    queryKey: ["panel-servers", panel?.id],
    queryFn: () => commands.listPanelServers(panel!.id),
    enabled: Boolean(panel),
  });

  const matchingServers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return (servers.data ?? []).filter((server) => {
      const matchesSearch = !normalizedSearch || `${server.name} ${server.identifier} ${server.node ?? ""} ${server.egg ?? ""} ${server.connect_address ?? ""}`.toLocaleLowerCase().includes(normalizedSearch);
      return matchesSearch;
    });
  }, [search, servers.data]);

  const pageCount = Math.max(1, Math.ceil(matchingServers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleServers = matchingServers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isPterodactyl2 = panel?.provider.toLowerCase() === "pterodactyl" &&
    /^v?2(\.|$)/.test(panel.pterodactyl_version);
  const resourceRequests = visibleServers.map(server => ({
    key: server.id,
    identifier: isPterodactyl2 ? server.id : server.identifier,
  }));
  const resourcesQuery = useQuery({
    queryKey: ["panel-server-resources-batch", panel?.id, resourceRequests.map(x=>x.identifier).join(",")],
    queryFn: () => commands.getPanelResourcesBatch(panel!.id, resourceRequests),
    enabled: Boolean(panel && resourceRequests.length),
    staleTime: RESOURCE_REFRESH_MS,
    refetchInterval: RESOURCE_REFRESH_MS,
    retry: 0,
  });
  const resourcesByKey = new Map((resourcesQuery.data ?? []).map(item=>[item.key,item]));
  const observedStates = (resourcesQuery.data ?? []).filter(item => item.resources?.state).length;
  const liveOnlineCount = (resourcesQuery.data ?? []).filter(item => item.resources?.state && ["running","online","started"].includes(item.resources.state.toLowerCase())).length;
  const failedStates = (resourcesQuery.data ?? []).filter(item=>item.error_code).length;
  const loadingResources = resourcesQuery.isFetching;
  const refresh = async () => {
    await servers.refetch();
    await resourcesQuery.refetch();
  };

  return (
    <div className="flex flex-col gap-3">
      <PanelDiagnostics open={showLogs} onOpenChange={setShowLogs} />
      {!panel ? (
        <EmptyState message="Aucun panel configuré. Ajoutez un panel puis connectez-vous." />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-4 sm:px-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Infrastructure · Client API</p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">Mes serveurs</h1>
                <p className="mt-1 text-xs text-muted-foreground">État et ressources de vos serveurs WISP et Pterodactyl.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={()=>setShowLogs(true)}><ScrollText className="size-4" /> Journal API</Button>
                <Button size="sm" variant="outline" onClick={()=>void refresh()} disabled={servers.isFetching || loadingResources}>
                  <RefreshCw className={servers.isFetching || loadingResources ? "size-4 animate-spin" : "size-4"}/> Actualiser
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Server className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{panel.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {servers.data ? `${servers.data.length} serveurs` : panel.provider.toUpperCase()}
                  {resourceRequests.length > 0 && (
                    observedStates > 0
                      ? <> · {liveOnlineCount} en ligne / {observedStates} états connus sur cette page</>
                      : <> · {failedStates > 0 || resourcesQuery.isError ? "États API indisponibles" : loadingResources ? "Chargement des états…" : "Aucun état exploitable"}</>
                  )}
                </p>
              </div>
            </div>
            {servers.data && servers.data.length > 0 && (
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  placeholder="Rechercher un serveur…"
                  aria-label="Rechercher un serveur"
                />
              </div>
            )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <p className="text-xs text-muted-foreground">Ressources actualisées automatiquement chaque minute</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {servers.data ? `${matchingServers.length} résultat${matchingServers.length > 1 ? "s" : ""}` : "Lecture de la liste du panel…"}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {servers.isPending ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Chargement des serveurs depuis le panel…</p>
            ) : servers.isError ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
                <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
                <p className="text-sm text-destructive">{String(servers.error)}</p>
                <Button variant="outline" onClick={() => void servers.refetch()}>Réessayer</Button>
              </div>
            ) : matchingServers.length === 0 ? (
              <EmptyState message={servers.data?.length ? "Aucun serveur ne correspond à votre recherche." : "Aucun serveur n’est associé à ce compte panel."} />
            ) : (
              <div className="grid gap-3.5 xl:grid-cols-2 2xl:grid-cols-3">
                {visibleServers.map((server) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    panelUrl={panel.base_url}
                    resources={resourcesByKey.get(server.id)?.resources ?? undefined}
                    loading={loadingResources}
                    failed={Boolean(resourcesByKey.get(server.id)?.error_code || resourcesQuery.isError)}
                    errorCode={resourcesByKey.get(server.id)?.error_code ?? (resourcesQuery.isError ? "batch_failed" : undefined)}
                  />
                ))}
              </div>
            )}
          </div>

          {matchingServers.length > PAGE_SIZE && (
            <nav className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5" aria-label="Pages de serveurs">
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, matchingServers.length)} sur {matchingServers.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label="Page précédente">
                  <ChevronLeft data-icon="inline-start" /> Précédent
                </Button>
                <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{currentPage} / {pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} aria-label="Page suivante">
                  Suivant <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
