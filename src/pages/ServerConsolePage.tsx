import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { invoke, isTauri } from "@tauri-apps/api/core";
import WebSocket from "@tauri-apps/plugin-websocket";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ArrowDown, ArrowLeft, Copy, Database, File, RefreshCw, Send, TerminalSquare, Trash2, WrapText } from "lucide-react";
import { toast } from "sonner";
import { AnsiLine, plainTerminalLine } from "@/lib/ansi-terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = resolvePanel(panels.data, requestedPanel);
  const servers = useQuery({
    queryKey: ["panel-servers", panel?.id],
    queryFn: () => commands.listPanelServers(panel!.id),
    enabled: Boolean(panel),
  });
  const server = servers.data?.find(s => s.identifier === identifier || s.id === identifier);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState("Non connecté");
  const [command, setCommand] = useState("");
  const [connectionId, setConnectionId] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const connection = useRef<WebSocket | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const connected = status === "Connecté";
  const append = (text: string) => setLines(prev => [...prev, text.slice(0, 16000)].slice(-MAX_LINES));

  useEffect(() => {
    if (!panel || !server || !isTauri()) return;
    let active = true;
    let removeListener: (() => void) | undefined;
    let ws: WebSocket | undefined;
    let stage: "credentials" | "socket" | "authentication" = "credentials";
    const report = (event: string) => { void invoke("record_console_connection_event", { event }).catch(() => undefined); };
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
              void ws?.send(JSON.stringify({ event: "send stats", args: [null] }));
              break;
            case "console output":
              if (typeof first === "string") append(first);
              break;
            case "status":
              if (typeof first === "string") append("[État] " + first);
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

  async function submit() {
    const value = command.trim();
    if (!value || value.length > 4096 || !connection.current || !connected) return;
    try {
      await connection.current.send(JSON.stringify({ event: "send command", args: [value] }));
      setCommand("");
    } catch { append("Commande non transmise : connexion indisponible."); void invoke("record_console_connection_event", {event: "ws_send_failed"}).catch(() => undefined); }
  }

  return <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
      <Button variant="ghost" size="icon" aria-label="Retour aux serveurs" onClick={() => navigate(serverListRoute(requestedPanel ?? panel?.id ?? null))}><ArrowLeft /></Button>
      <TerminalSquare className="size-5 text-primary" />
      <div className="min-w-0 flex-1"><h1 className="truncate font-semibold">Console · {server?.name ?? "Serveur"}</h1><p className="text-xs text-muted-foreground">Flux Wings en temps réel · session éphémère</p></div>
      <span role="status" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${connected ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : status.includes("Connexion") ? "border-amber-500/25 bg-amber-500/10 text-amber-500" : "border-border bg-secondary text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-current"}`} />{status}</span>
      <Button variant="outline" size="sm" disabled={!panel || !server} onClick={() => setConnectionId(i => i + 1)}><RefreshCw className="size-4" /> Reconnecter</Button>
    </div>
    {panels.isSuccess && !panel && <p role="alert" className="border-b px-4 py-3 text-sm text-destructive">Le panel demandé n'existe pas ou n'est plus configuré. Revenez à la liste des serveurs pour choisir un compte.</p>}
    <nav aria-label="Sections du serveur" className="flex gap-1 border-b px-3">
      <span className="inline-flex items-center gap-2 border-b-2 border-primary px-3 py-2 text-sm font-medium"><TerminalSquare className="size-4" />Console</span>
      {panel && server && <>
        <Link to={serverSectionRoute(panel.id, server.identifier, "files")} className="inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><File className="size-4" />Fichiers</Link>
        <Link to={serverSectionRoute(panel.id, server.identifier, "databases")} className="inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><Database className="size-4" />Bases de données</Link>
      </>}
    </nav>
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/25 px-4 py-2">
      <span className="mr-auto font-mono text-[11px] text-muted-foreground">Wings · {lines.length} entrée(s)</span>
      <Button size="sm" variant={autoScroll ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setAutoScroll(value => !value)} aria-pressed={autoScroll}><ArrowDown className="size-3.5" /> Défilement {autoScroll ? "actif" : "arrêté"}</Button>
      <Button size="sm" variant={wrapLines ? "secondary" : "ghost"} className="h-8 gap-1.5 text-xs" onClick={() => setWrapLines(value => !value)} aria-pressed={wrapLines}><WrapText className="size-3.5" /> Retour ligne</Button>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => void copyOutput()} disabled={!lines.length}><Copy className="size-3.5" /> Copier</Button>
      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setLines([])} disabled={!lines.length}><Trash2 className="size-3.5" /> Effacer</Button>
    </div>
    <div ref={output} role="log" aria-live="off" aria-label="Sortie console du serveur" className="h-[min(62vh,650px)] overflow-auto bg-zinc-950 px-4 py-3 font-mono text-[12px] leading-[1.65] text-zinc-100" onScroll={event => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight > 60 && autoScroll) setAutoScroll(false); }}>
      {lines.length ? lines.map((line, i) => <div key={i} className={wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre w-max min-w-full"}><AnsiLine value={line} /></div>) : <p className="text-zinc-400">Les sorties de la console apparaîtront ici après authentification.</p>}
    </div>
    <form className="flex gap-2 border-t p-3" onSubmit={event => {event.preventDefault();void submit();}}>
      <Input value={command} onChange={event => setCommand(event.target.value)} placeholder="Commande du serveur…" aria-label="Commande console" maxLength={4096} disabled={!connected || server?.suspended} />
      <Button type="submit" className="gap-2" disabled={!connected || server?.suspended || !command.trim()}><Send className="size-4" /> Envoyer</Button>
    </form>
    <p className="px-4 pb-3 text-xs text-muted-foreground">Connexion via Wings WebSocket avec les permissions du compte Client API. Les serveurs suspendus ou les fournisseurs sans endpoint compatible peuvent refuser la connexion.</p>
  </section>;
}
