import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke, isTauri } from "@tauri-apps/api/core";
import WebSocket from "@tauri-apps/plugin-websocket";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ArrowDown, Clock3, Copy, Database, Download, ExternalLink, File, MoreHorizontal, RefreshCw, Search, Send, Skull, Square, Play, RotateCw, TerminalSquare, Trash2, WrapText, X } from "lucide-react";
import { toast } from "sonner";
import { AnsiLine, plainTerminalLine } from "@/lib/ansi-terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { save } from "@tauri-apps/plugin-dialog";
import { commands } from "@/lib/tauri";
import { resolvePanel, serverListRoute, serverSectionRoute } from "@/lib/panel-navigation";

type Credentials = { socket: string; token: string };
type WingsEvent = { event?: string; args?: unknown[] };
const MAX_LINES = 1000;
const API_ERROR_HINTS: Record<string, string> = {
  api_auth_failed: "Le jeton Client API est refusé (401).",
  api_forbidden: "Le compte Client API n'a pas les permissions requises (403).",
  api_not_found: "Le serveur ou l'endpoint WebSocket est introuvable (404).",
  api_rate_limited: "Le panel limite temporairement les appels API (429).",
  api_network: "La connexion HTTPS avec le panel a échoué.",
  api_invalid_response: "Le panel ne fournit pas les informations Wings attendues.",
  api_token: "La clé Client API enregistrée est indisponible.",
  invalid_url: "L'adresse WebSocket ou du panel est refusée par la validation de sécurité.",
  service_unavailable: "Le nom de domaine ou le service du panel est indisponible.",
};
function safeApiError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as {code?: unknown}).code;
    if (typeof code === "string" && Object.prototype.hasOwnProperty.call(API_ERROR_HINTS, code)) return API_ERROR_HINTS[code];
  }
  return "Impossible d'obtenir les accès de console via la Client API.";
}

export default function ServerConsolePage() {
  const { identifier } = useParams();
  const [searchParams] = useSearchParams();
  const requestedPanel = searchParams.get("panel");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = resolvePanel(panels.data, requestedPanel);
  const servers = useQuery({
    queryKey: ["panel-servers", panel?.id],
    queryFn: () => commands.listPanelServers(panel!.id),
    enabled: Boolean(panel),
  });
  const server = servers.data?.find(s => s.identifier === identifier || s.id === identifier);
  const resources = useQuery({
    queryKey: ["panel-server-resources", panel?.id, server?.identifier],
    queryFn: () => commands.getPanelServerResources(panel!.id, server!.identifier),
    enabled: Boolean(panel && server),
    refetchInterval: 10_000,
    retry: 0,
  });
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState("Non connecté");
  const [command, setCommand] = useState("");
  const [connectionId, setConnectionId] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const [powerAction, setPowerAction] = useState<"start" | "restart" | "stop" | "kill" | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const connection = useRef<WebSocket | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const connected = status === "Connecté";
  const append = (text: string) => setLines(prev => [...prev, text.slice(0, 16000)].slice(-MAX_LINES));
  const matches = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    return term ? lines.flatMap((line, index) => line.toLocaleLowerCase().includes(term) ? [index] : []) : [];
  }, [lines, searchTerm]);
  const goToMatch = useCallback((delta: number) => {
    if (!matches.length) return;
    const next = (currentMatch + delta + matches.length) % matches.length;
    setCurrentMatch(next);
    requestAnimationFrame(() => output.current?.querySelector(`[data-console-line="${matches[next]}"]`)?.scrollIntoView({ block: "center" }));
  }, [currentMatch, matches]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInput.current?.focus());
      } else if (event.key === "F3" && searchOpen && matches.length) {
        event.preventDefault();
        goToMatch(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, matches.length, goToMatch]);

  function formatUptime(milliseconds?: number | null) {
    if (milliseconds == null || !Number.isFinite(milliseconds) || milliseconds < 0) return null;
    const minutes = Math.floor(milliseconds / 60_000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes % 1440 / 60);
    const remainder = minutes % 60;
    return [days ? `${days} j` : null, `${hours} h`, `${remainder} min`].filter(Boolean).join(" ");
  }

  useEffect(() => {
    if (!panel || !server || !isTauri()) return;
    let active = true;
    let removeListener: (() => void) | undefined;
    let ws: WebSocket | undefined;
    let stage: "credentials" | "socket" | "authentication" = "credentials";
    const report = (event: string, count?: number) => { void invoke("record_console_connection_event", { event, provider: panel.provider, count }).catch(() => undefined); };
    let outputBatch = 0;
    const run = async () => {
      setStatus("Connexion…");
      try {
        const isV2 = panel.provider.toLowerCase() === "pterodactyl" &&
          /^v?2(\.|$)/.test(panel.pterodactyl_version);
        const creds = await invoke<Credentials>("get_panel_console_credentials", {
          id: panel.id,
          identifier: isV2 ? server.id : server.identifier,
        });
        if (!active) return;
        const socketUrl = new URL(creds.socket);
        if (socketUrl.protocol !== "wss:" || !socketUrl.hostname || socketUrl.username || socketUrl.password) {
          throw new Error("Adresse Wings non sécurisée.");
        }
        stage = "socket";
        // Wings validates the handshake Origin against its configured PanelLocation.
        // A Tauri native WebSocket does not automatically use the panel's origin.
        const panelOrigin = new URL(panel.base_url).origin;
        ws = await WebSocket.connect(creds.socket, {
          headers: { Origin: panelOrigin },
          maxMessageSize: 1_048_576,
          maxFrameSize: 1_048_576,
        });
        report("ws_connected");
        if (!active) { await ws.disconnect(); return; }
        connection.current = ws;
        removeListener = ws.addListener(message => {
          if (message.type === "Close") { if (active) { setStatus("Déconnecté"); report("ws_closed"); } return; }
          if (message.type !== "Text") return;
          let event: WingsEvent;
          try { event = JSON.parse(message.data) as WingsEvent; } catch { return; }
          const first = event.args?.[0];
          switch (event.event) {
            case "auth success":
              setStatus("Connecté");
              report("ws_authenticated");
              void ws?.send(JSON.stringify({ event: "send logs", args: [null] }));
              report("ws_logs_requested");
              void ws?.send(JSON.stringify({ event: "send stats", args: [null] }));
              report("ws_stats_requested");
              break;
            case "console output":
              if (typeof first === "string") {
                append(first);
                outputBatch += 1;
                if (outputBatch >= 50) { report("ws_output_batch", outputBatch); outputBatch = 0; }
              }
              break;
            case "status":
              if (typeof first === "string") { append("[État] " + first); report("ws_status_received"); }
              break;
            case "auth failed":
            case "jwt error":
              setStatus("Authentification refusée");
              append("Authentification Wings refusée : vérifiez les permissions de console.");
              report("ws_auth_failed");
              break;
            case "token expiring":
            case "token expired":
              setStatus("Renouvellement requis");
              report("ws_expired");
              setConnectionId(id => id + 1);
              break;
            default: break;
          }
        });
        // Token is used once in memory and is never logged or saved.
        stage = "authentication";
        await ws.send(JSON.stringify({ event: "auth", args: [creds.token] }));
      } catch (error) {
        if (active) {
          if (stage === "socket") report("ws_connect_failed");
          if (stage === "authentication") report("ws_auth_failed");
          setStatus("Console indisponible");
          append(stage === "credentials" ? safeApiError(error) : stage === "socket" ? "Échec de la connexion sécurisée à Wings (WebSocket)." : "Impossible d'authentifier la session Wings.");
          append("Détails : Aide → Journal des API.");
        }
      }
    };
    void run();
    return () => { active = false; removeListener?.(); connection.current = null; if (ws) void ws.disconnect(); };
  }, [panel, server, connectionId]);
  useEffect(() => { if (autoScroll) output.current?.scrollTo({ top: output.current.scrollHeight }); }, [lines, autoScroll]);

  async function copyOutput() {
    try {
      const plain = lines.map(plainTerminalLine).join("\n");
      if (isTauri()) await writeText(plain);
      else await navigator.clipboard.writeText(plain);
      toast.success("Sortie de console copiée");
    } catch { toast.error("Copie indisponible sur cet appareil"); }
  }

  async function exportOutput() {
    if (!lines.length) return;
    try {
      const path = await save({ title: "Exporter les logs de la console", defaultPath: `${(server?.name ?? "serveur").replace(/[^\p{L}\p{N}_-]+/gu, "-")}-console.log`, filters: [{ name: "Logs de console", extensions: ["log", "txt"] }] });
      if (!path) return;
      await commands.exportConsoleLogs(path, lines.map(plainTerminalLine).join("\n"));
      toast.success("Logs enregistrés localement.");
    } catch { toast.error("Impossible d’exporter les logs."); }
  }

  async function sendPowerAction(action: "start" | "restart" | "stop" | "kill") {
    if (!panel || !server || powerAction || server.suspended) return;
    const needsConfirmation = action !== "start";
    const labels = { start: "Démarrer", restart: "Redémarrer", stop: "Arrêter", kill: "Forcer l’arrêt" };
    if (needsConfirmation && !window.confirm(`${labels[action]} « ${server.name} » ?${action === "kill" ? "\n\nL’arrêt forcé peut interrompre des écritures en cours." : ""}`)) return;
    setPowerAction(action);
    try {
      await commands.sendPanelServerPowerSignal(panel.id, server.identifier, action);
      toast.success(`Action « ${labels[action]} » envoyée.`);
      await Promise.all([
        resources.refetch(),
        queryClient.invalidateQueries({ queryKey: ["panel-servers", panel.id] }),
      ]);
    } catch { toast.error(`Impossible d’envoyer l’action « ${labels[action].toLocaleLowerCase()} » au panel.`); }
    finally { setPowerAction(null); }
  }

  async function submit() {
    const value = command.trim();
    if (!value || value.length > 4096 || !connection.current || !connected) return;
    try {
      await connection.current.send(JSON.stringify({ event: "send command", args: [value] }));
      void invoke("record_console_connection_event", { event: "ws_command_sent", provider: panel?.provider }).catch(() => undefined);
      setCommand("");
    } catch { append("Commande non transmise : connexion indisponible."); void invoke("record_console_connection_event", {event: "ws_send_failed", provider: panel?.provider}).catch(() => undefined); }
  }

  return <FloatingPanel open onOpenChange={open => { if (!open) navigate(serverListRoute(requestedPanel ?? panel?.id ?? null)); }} ariaDescribedBy="server-console-description" className="h-[min(88vh,850px)] w-[min(94vw,1180px)]">
    <DialogHeader className="sr-only"><DialogTitle>Console · {server?.name ?? "Serveur"}</DialogTitle><DialogDescription id="server-console-description">Console flottante du serveur, connectée au flux Wings.</DialogDescription></DialogHeader>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 pr-14">
      <TerminalSquare className="size-5 text-primary" />
      <div className="min-w-0 flex-1"><h1 className="truncate font-semibold">Console · {server?.name ?? "Serveur"}</h1><p className="text-xs text-muted-foreground">Flux Wings en temps réel · session éphémère</p></div>
      <span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${connected ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : status.includes("Connexion") ? "border-amber-500/25 bg-amber-500/10 text-amber-500" : "border-border bg-secondary text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-current"}`} />{status}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!panel || !server} aria-label="Options du serveur"><MoreHorizontal className="size-4"/>Options</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{server?.name ?? "Serveur"}</DropdownMenuLabel>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onSelect={() => setConnectionId(i => i + 1)}><RefreshCw/>Reconnecter la console</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { void queryClient.invalidateQueries({ queryKey: ["panel-servers", panel?.id] }); }}><RefreshCw/>Actualiser les informations</DropdownMenuItem>
          <DropdownMenuItem disabled={!server?.identifier} onSelect={() => { if (server?.identifier) void writeText(server.identifier).then(() => toast.success("Identifiant du serveur copié")).catch(() => toast.error("Copie indisponible")); }}><Copy/>Copier l’identifiant</DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem disabled={!panel || !server} onSelect={() => { if (panel && server) navigate(serverSectionRoute(panel.id, server.identifier, "files")); }}><File/>Ouvrir les fichiers</DropdownMenuItem>
          <DropdownMenuItem disabled={!panel || !server} onSelect={() => { if (panel && server) navigate(serverSectionRoute(panel.id, server.identifier, "databases")); }}><Database/>Bases de données</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {panels.isSuccess && !panel && <p role="alert" className="border-b px-4 py-3 text-sm text-destructive">Le panel demandé n'existe pas ou n'est plus configuré. Revenez à la liste des serveurs pour choisir un compte.</p>}
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/25 px-4 py-2">
      <span className="mr-auto font-mono text-[11px] text-muted-foreground">Wings · {lines.length} entrée(s)</span>
      {formatUptime(resources.data?.uptime_ms) && <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground" title="Durée de fonctionnement du serveur"><Clock3 className="size-3.5"/>En ligne depuis {formatUptime(resources.data?.uptime_ms)}</span>}
      {searchOpen && <div className="flex h-8 items-center gap-1 rounded-md border bg-background px-2"><Search className="size-3.5 text-muted-foreground"/><input ref={searchInput} value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setCurrentMatch(0); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); goToMatch(event.shiftKey ? -1 : 1); } if (event.key === "Escape") { setSearchOpen(false); setSearchTerm(""); } }} placeholder="Rechercher dans la console…" aria-label="Rechercher dans la console" className="w-48 bg-transparent text-xs outline-none"/><span className="min-w-10 text-center text-[10px] text-muted-foreground">{matches.length ? `${currentMatch + 1}/${matches.length}` : "0"}</span><Button size="icon-sm" variant="ghost" aria-label="Résultat précédent" onClick={() => goToMatch(-1)} disabled={!matches.length}>↑</Button><Button size="icon-sm" variant="ghost" aria-label="Résultat suivant" onClick={() => goToMatch(1)} disabled={!matches.length}>↓</Button><Button size="icon-sm" variant="ghost" aria-label="Fermer la recherche" onClick={() => { setSearchOpen(false); setSearchTerm(""); }}><X className="size-3.5"/></Button></div>}
      <Button size="icon-sm" variant={searchOpen ? "secondary" : "ghost"} aria-label="Rechercher dans la console (Ctrl+F)" title="Rechercher (Ctrl+F)" onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchInput.current?.focus()); }}><Search className="size-3.5"/></Button>
      <Button size="icon-sm" variant="ghost" aria-label="Ouvrir la console dans une fenêtre séparée" title="Ouvrir la console dans une fenêtre séparée" disabled={!panel || !server} onClick={() => { if (panel && server) void commands.openDetachedConsoleWindow(panel.id, server.identifier).catch(() => toast.error("Impossible d’ouvrir la fenêtre console.")); }}><ExternalLink className="size-3.5"/></Button>
      <Button size="icon-sm" variant="ghost" aria-label="Exporter les logs localement" title="Exporter les logs localement" onClick={() => void exportOutput()} disabled={!lines.length}><Download className="size-3.5"/></Button>
      <Button size="sm" variant={autoScroll ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setAutoScroll(value => !value)} aria-pressed={autoScroll}><ArrowDown className="size-3.5" /> Défilement {autoScroll ? "actif" : "arrêté"}</Button>
      <Button size="sm" variant={wrapLines ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setWrapLines(value => !value)} aria-pressed={wrapLines}><WrapText className="size-3.5" /> Retour ligne</Button>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => void copyOutput()} disabled={!lines.length}><Copy className="size-3.5" /> Copier</Button>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setLines([])} disabled={!lines.length}><Trash2 className="size-3.5" /> Effacer</Button>
    </div>
    <div ref={output} role="log" aria-live="off" aria-label="Sortie console du serveur" className="h-[min(62vh,650px)] overflow-auto bg-zinc-950 px-4 py-3 font-mono text-[12px] leading-[1.65] text-zinc-100" onScroll={event => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight > 60 && autoScroll) setAutoScroll(false); }}>
      {lines.length ? (searchTerm.trim() ? matches.map(i => <div key={i} data-console-line={i} className={`${wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre w-max min-w-full"} ${matches[currentMatch] === i ? "rounded bg-primary/20" : ""}`}><AnsiLine value={lines[i]} /></div>) : lines.map((line, i) => <div key={i} data-console-line={i} className={wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre w-max min-w-full"}><AnsiLine value={line} /></div>)) : <p className="text-zinc-400">Les sorties de la console apparaîtront ici après authentification.</p>}
      {searchTerm.trim() && !matches.length && <p className="text-zinc-400">Aucune correspondance pour « {searchTerm} ».</p>}
    </div>
    <form className="flex gap-2 border-t p-3" onSubmit={event => {event.preventDefault();void submit();}}>
      <Input value={command} onChange={event => setCommand(event.target.value)} placeholder="Commande du serveur…" aria-label="Commande console" maxLength={4096} disabled={!connected || server?.suspended} />
      <Button type="submit" className="gap-2" disabled={!connected || server?.suspended || !command.trim()}><Send className="size-4" /> Envoyer</Button>
    </form>
    <div className="flex flex-wrap justify-center gap-1 border-t px-3 py-2">
      <Button size="sm" variant="outline" disabled={!panel || !server || server.suspended || resources.data?.state === "running" || powerAction !== null} onClick={() => void sendPowerAction("start")}><Play className="size-3.5 text-emerald-500"/>Démarrer</Button>
      <Button size="sm" variant="outline" disabled={!panel || !server || server.suspended || powerAction !== null} onClick={() => void sendPowerAction("restart")}><RotateCw className="size-3.5 text-sky-500"/>Redémarrer</Button>
      <Button size="sm" variant="outline" disabled={!panel || !server || server.suspended || (!connected && resources.data?.state !== "running") || powerAction !== null} onClick={() => void sendPowerAction("stop")}><Square className="size-3 text-amber-500"/>Arrêter</Button>
      <Button size="sm" variant="destructive" disabled={!panel || !server || server.suspended || (!connected && resources.data?.state !== "running") || powerAction !== null} onClick={() => void sendPowerAction("kill")}><Skull className="size-3.5"/>Forcer l’arrêt</Button>
      {powerAction && <span role="status" className="self-center px-2 text-xs text-muted-foreground">Action envoyée…</span>}
    </div>
    <p className="px-4 pb-3 text-xs text-muted-foreground">Connexion via Wings WebSocket avec les permissions du compte Client API. Les serveurs suspendus ou les fournisseurs sans endpoint compatible peuvent refuser la connexion.</p>
    </section>
  </FloatingPanel>;
}
