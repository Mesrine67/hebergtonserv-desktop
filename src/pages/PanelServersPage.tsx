import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleOff, ExternalLink, Cpu, Database, File, HardDrive, MemoryStick, MoreHorizontal, RefreshCw, Search, Server, Users, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/page-shell";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { commands, type PanelCapability, type PanelServer, type PanelServerResources, type PanelSubuser } from "@/lib/tauri";
import { consoleRoute, resolvePanel, serverSectionRoute } from "@/lib/panel-navigation";

const PAGE_SIZE = 12;
const RESOURCE_REFRESH_MS = 60_000;

function ServerSearch({ servers, onOpen }: { servers: PanelServer[]; onOpen: (server: PanelServer) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(value => !value); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return <>
    <Button type="button" variant="outline" size="icon" className="size-8" aria-label="Rechercher un serveur" title="Rechercher un serveur (Ctrl+K)" onClick={() => setOpen(true)}><Search className="size-4"/></Button>
    <CommandDialog open={open} onOpenChange={setOpen} title="Rechercher un serveur" description="Filtrez les serveurs par nom, identifiant ou adresse.">
      <Command>
        <CommandInput placeholder="Rechercher un serveur…" aria-label="Rechercher un serveur"/>
        <CommandList>
          <CommandEmpty>Aucun serveur trouvé.</CommandEmpty>
          <CommandGroup heading="Serveurs du panel">
            {servers.map(server => <CommandItem key={server.id} value={`${server.name} ${server.identifier} ${server.node ?? ""} ${server.connect_address ?? ""}`} onSelect={() => { setOpen(false); onOpen(server); }}>
              <Server className="text-primary"/><span className="min-w-0 flex-1 truncate">{server.name}</span><span className="font-mono text-xs text-muted-foreground">{server.identifier}</span>
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  </>;
}

function formatBytes(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 Mio";
  const units = ["o", "Kio", "Mio", "Gio", "Tio"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function memoryBytes(server: PanelServer, resources?: PanelServerResources) {
  return resources?.memory_limit_bytes ?? (server.limits.memory != null && server.limits.memory >= 0 ? server.limits.memory * 1024 * 1024 : undefined);
}

function diskBytes(server: PanelServer, resources?: PanelServerResources) {
  return resources?.disk_limit_bytes ?? (server.limits.disk != null && server.limits.disk >= 0 ? server.limits.disk * 1024 * 1024 : undefined);
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

function Stat({icon: Icon, label, value, percent}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  percent?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border bg-muted/25 px-2.5 py-2.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[0.6875rem] font-medium">{label}</span>
      </div>
      <p className="min-h-8 text-xs/4 font-semibold tabular-nums text-card-foreground">{value}</p>
      {percent != null && (
        <Progress value={percent} aria-label={`${label} utilisé`} className="h-1" />
      )}
    </div>
  );
}

function ServerCard({server, resources: stats, loading, failed, errorCode, onOpenConsole, onOpenFiles, onOpenDatabases, panelId, subuserIdentifier}: {
  server: PanelServer;
  panelId: string;
  subuserIdentifier: string;
  onOpenConsole: () => void;
  onOpenFiles: () => void;
  onOpenDatabases: () => void;
  resources?: PanelServerResources;
  loading: boolean;
  failed: boolean;
  errorCode?: string;
}) {
  const [subusersOpen, setSubusersOpen] = useState(false);
  const subusers = useQuery({queryKey: ["panel-server-subusers", panelId, subuserIdentifier], queryFn: () => commands.listPanelServerSubusers(panelId, subuserIdentifier), enabled: subusersOpen, retry: 0});
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
  const stateIcon = state === "online" ? <CircleCheck data-icon="inline-start" className="text-emerald-500" aria-hidden="true" /> : state === "offline" || state === "suspended" ? <CircleOff data-icon="inline-start" aria-hidden="true" /> : <CircleAlert data-icon="inline-start" className="text-amber-500" aria-hidden="true" />;
  const stateVariant = state === "offline" || state === "suspended" || failed ? "destructive" : "outline";
  return (
    <Card role="article" className="group/card gap-0 transition-[border-color,box-shadow] hover:ring-primary/25 hover:shadow-md">
      <CardHeader className="border-b bg-muted/15">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server aria-hidden="true" />
          </div>
          <div className="grid min-w-0 flex-1 gap-1">
            <CardTitle role="heading" aria-level={2} className="truncate text-base font-semibold">{server.name}</CardTitle>
            <CardDescription className="truncate font-mono">{address ?? server.node ?? "Adresse indisponible"}{address && server.node ? ` · ${server.node}` : ""}</CardDescription>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">ID {shortId}</span>
          </div>
        </div>
        <CardAction>
          <Badge variant={stateVariant} className={cn("bg-background/80 text-foreground", state === "online" && !failed && "border-emerald-500/30", state !== "online" && state !== "offline" && state !== "suspended" && !failed && "border-amber-500/30")}>
            {stateIcon}{stateText}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 py-3">
        {server.egg && <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="max-w-full truncate">{server.egg}</Badge>
          {server.installing && <CardDescription>Installation en cours</CardDescription>}
        </div>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={onOpenConsole} aria-label={`Ouvrir la console du serveur ${server.name}`}>
            <ExternalLink data-icon="inline-start" /> Console
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label={`Options du serveur ${server.name}`}><MoreHorizontal data-icon="inline-start" /> Gérer</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={onOpenFiles}><File data-icon="inline-start" /> Fichiers</DropdownMenuItem>
                <DropdownMenuItem onSelect={onOpenDatabases}><Database data-icon="inline-start" /> Bases de données</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSubusersOpen(value => !value)}><Users data-icon="inline-start" /> {subusersOpen ? "Masquer les sous-utilisateurs" : "Sous-utilisateurs"}</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
      {subusersOpen && <CardContent className="border-t pt-3" aria-live="polite">
        {subusers.isPending ? <p className="text-xs text-muted-foreground">Lecture des sous-utilisateurs…</p> : subusers.isError ? <p role="alert" className="text-xs text-destructive">{errorMessage(subusers.error)}</p> : !subusers.data?.supported ? <p className="text-xs text-muted-foreground">{subusers.data?.message ?? "Fonction non documentée pour ce panel."}</p> : <SubuserList capability={subusers.data} />}
      </CardContent>}
      <CardContent className="grid grid-cols-2 gap-1.5 border-t py-3 sm:grid-cols-4">
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
          <Stat icon={Users} label="Joueurs" value={failed ? "Stats indisponibles" : loading ? "Chargement…" : "Jeu sans requête"} />
        )}
      </CardContent>
      {stats && (stats.network_rx_bytes != null || stats.network_tx_bytes != null) && (
        <CardFooter className="justify-start gap-1 border-t text-xs text-muted-foreground tabular-nums">
          Réseau : ↓ {formatBytes(stats.network_rx_bytes)} · ↑ {formatBytes(stats.network_tx_bytes)}
        </CardFooter>
      )}
      {failed && (
        <CardFooter className="justify-start border-t text-xs text-amber-500" role="status">
          Ressources indisponibles ({errorCode ?? "api_network"}). Ouvrez Aide → Journal des API pour diagnostiquer les permissions et les limites de requêtes.
        </CardFooter>
      )}
    </Card>
  );
}

function SubuserList({ capability }: { capability: PanelCapability<PanelSubuser[]> }) {
  const users = capability.value ?? [];
  if (!users.length) return <p className="text-xs text-muted-foreground">Aucun sous-utilisateur sur ce serveur.</p>;
  return <ul className="space-y-2">
    {users.map(user => <li key={user.uuid} className="rounded-lg bg-muted/45 px-3 py-2">
      <p className="truncate text-sm font-medium">{user.username || user.email || user.identifier || user.uuid}</p>
      {user.email && user.username && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
      {user.permissions.length > 0 ? <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{user.permissions.length} permissions</summary>
          <ul className="mt-1 max-h-32 list-inside list-disc overflow-auto pl-1">
            {user.permissions.map(permission => <li key={permission} className="break-all">{permission}</li>)}
          </ul>
        </details> : <p className="mt-1 text-xs text-muted-foreground">Aucune permission communiquée par le panel.</p>}
    </li>)}
  </ul>;
}

export default function PanelServersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = resolvePanel(panels.data, searchParams.get("panel"));
  const servers = useQuery({queryKey: ["panel-servers", panel?.id], queryFn: () => commands.listPanelServers(panel!.id), enabled: Boolean(panel)});
  const matchingServers = useMemo(() => servers.data ?? [], [servers.data]);
  const pageCount = Math.max(1, Math.ceil(matchingServers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleServers = matchingServers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isPterodactyl2 = panel?.provider.toLowerCase() === "pterodactyl" && /^v?2(\.|$)/.test(panel.pterodactyl_version);
  const resourceRequests = visibleServers.map(server => ({key: server.id, identifier: isPterodactyl2 ? server.id : server.identifier}));
  const resourcesQuery = useQuery({queryKey: ["panel-server-resources-batch", panel?.id, resourceRequests.map(x=>x.identifier).join(",")], queryFn: () => commands.getPanelResourcesBatch(panel!.id, resourceRequests), enabled: Boolean(panel && resourceRequests.length), staleTime: RESOURCE_REFRESH_MS, refetchInterval: RESOURCE_REFRESH_MS, retry: 0});
  const resourcesByKey = new Map((resourcesQuery.data ?? []).map(item=>[item.key,item]));
  const loadingResources = resourcesQuery.isFetching;
  const refresh = async () => {
    await servers.refetch();
    await resourcesQuery.refetch();
  };
  return (
    <div className="flex flex-col gap-3">
      {!panel ? (
        <EmptyState message="Aucun panel configuré. Ajoutez un panel puis connectez-vous." />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1" aria-label="Actions des serveurs">
            <ServerSearch servers={servers.data ?? []} onOpen={server => navigate(consoleRoute(panel.id, server.identifier))}/>
            <div className="ml-auto flex items-center gap-2">
              {(panels.data?.length ?? 0) > 1 && (
                <Select value={panel.id} onValueChange={(value) => { setSearchParams({ panel: value }); setPage(1); }}>
                  <SelectTrigger className="w-48" aria-label="Choisir un panel"><SelectValue placeholder="Choisir un panel"/></SelectTrigger>
                  <SelectContent><SelectGroup>{panels.data?.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              )}
            <Button size="icon" variant="outline" className="size-8" aria-label="Actualiser les serveurs" title="Actualiser les serveurs" onClick={()=>void refresh()} disabled={servers.isFetching || loadingResources}>
              <RefreshCw data-icon="inline-start" className={cn((servers.isFetching || loadingResources) && "animate-spin")}/>
            </Button>
          </div>
          </div>

          <div className="px-0.5">
            {servers.isPending ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Chargement des serveurs depuis le panel…</p>
            ) : servers.isError ? (
              <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
                <CircleAlert className="size-8 text-destructive" aria-hidden="true" />
                <p className="text-sm text-destructive">{errorMessage(servers.error)}</p>
                <Button variant="outline" onClick={() => void servers.refetch()}>Réessayer</Button>
              </div>
            ) : matchingServers.length === 0 ? (
              <EmptyState message={servers.data?.length ? "Aucun serveur ne correspond à votre recherche." : "Aucun serveur n’est associé à ce compte panel."} />
            ) : (
              <div className="grid gap-3.5 xl:grid-cols-2 2xl:grid-cols-3">
                {visibleServers.map((server) => (
                  <ServerCard
                    key={server.id}
                    panelId={panel.id}
                    subuserIdentifier={isPterodactyl2 ? server.id : server.identifier}
                    server={server}
                    onOpenConsole={() => { if (panel) navigate(consoleRoute(panel.id, server.identifier)); }}
                    onOpenFiles={() => { if (panel) navigate(serverSectionRoute(panel.id, server.identifier, "files")); }}
                    onOpenDatabases={() => { if (panel) navigate(serverSectionRoute(panel.id, server.identifier, "databases")); }}
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
            <nav className="flex items-center justify-between gap-3 border-t pt-3" aria-label="Pages de serveurs">
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
