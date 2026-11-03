import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowLeft, ChevronRight, Copy, Database, Eye, EyeOff, ExternalLink, File, Folder, RefreshCw, Search, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { commands } from "@/lib/tauri";
import { resolvePanel, serverListRoute, serverSectionRoute } from "@/lib/panel-navigation";

type Section = "files" | "databases";
function apiIdentifier(provider: string, version: string, id: string, identifier: string) {
  // WISP panels expose Client API server routes by their short server identifier,
  // matching the identifier used by their own /server/{identifier}/... pages.
  if (provider.toLowerCase() === "wisp") return identifier;
  return /^v?2(\.|$)/.test(version) ? id : identifier;
}
export default function ServerManagementPage({ section }: { section: Section }) {
  const { identifier = "" } = useParams();
  const [params] = useSearchParams();
  const requestedPanel = params.get("panel");
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = resolvePanel(panels.data, requestedPanel);
  const servers = useQuery({ queryKey: ["panel-servers", panel?.id], queryFn: () => commands.listPanelServers(panel!.id), enabled: Boolean(panel) });
  const server = servers.data?.find(item => item.identifier === identifier || item.id === identifier);
  const requestId = panel && server ? apiIdentifier(panel.provider, panel.pterodactyl_version, server.id, server.identifier) : "";
  const [path, setPath] = useState("/");
  const [selected, setSelected] = useState<string | null>(null);
  const [fileFilter, setFileFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const files = useQuery({ queryKey: ["panel-server-files", panel?.id, requestId, path], queryFn: () => commands.listPanelServerFiles(panel!.id, requestId, path), enabled: Boolean(panel && requestId && section === "files"), staleTime: 15_000 });
  const content = useQuery({ queryKey: ["panel-server-file", panel?.id, requestId, selected], queryFn: () => commands.readPanelServerFile(panel!.id, requestId, selected!), enabled: Boolean(panel && requestId && selected && section === "files"), staleTime: 0 });
  const databases = useQuery({ queryKey: ["panel-server-databases", panel?.id, requestId], queryFn: () => commands.listPanelServerDatabases(panel!.id, requestId), enabled: Boolean(panel && requestId && section === "databases"), staleTime: 15_000 });
  const breadcrumbs = useMemo(() => path.split("/").filter(Boolean), [path]);
  const visibleFiles = useMemo(() => (files.data ?? [])
    .filter(entry => showHidden || !entry.name.startsWith("."))
    .filter(entry => entry.name.toLocaleLowerCase().includes(fileFilter.trim().toLocaleLowerCase()))
    .sort((a, b) => {
      const directoryOrder = Number(b.kind === "directory") - Number(a.kind === "directory");
      return directoryOrder || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    }), [files.data, fileFilter, showHidden]);
  const title = section === "files" ? "Fichiers" : "Bases de données";
  const databaseCount = databases.data?.length ?? 0;
  const databaseLimit = server?.limits.databases;
  const databaseUsage = databaseLimit == null ? null : Math.min(100, databaseLimit === 0 ? 100 : databaseCount / databaseLimit * 100);
  const [revealedPasswords, setRevealedPasswords] = useState<string[]>([]);
  const copyValue = async (value: string, label: string) => {
    try { if (isTauri()) await writeText(value); else await navigator.clipboard.writeText(value); toast.success(`${label} copié.`); }
    catch { toast.error(`Impossible de copier ${label.toLocaleLowerCase()}.`); }
  };

  return <section className="space-y-4">
    <header className="flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="icon" asChild><Link to={serverListRoute(requestedPanel ?? panel?.id ?? null)} aria-label="Retour aux serveurs"><ArrowLeft /></Link></Button>
      <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wide text-muted-foreground">{panel?.name ?? "Panel"} · {server?.name ?? "Serveur"}</p><h1 className="text-2xl font-semibold">{title}</h1></div>
      {section === "files" && <Button variant="outline" size="sm" onClick={() => void files.refetch()} disabled={files.isFetching}><RefreshCw className={`mr-2 size-4 ${files.isFetching ? "animate-spin" : ""}`} />Actualiser</Button>}
      {section === "databases" && <Button variant="outline" size="sm" onClick={() => void databases.refetch()} disabled={databases.isFetching}><RefreshCw className={`mr-2 size-4 ${databases.isFetching ? "animate-spin" : ""}`} />Actualiser</Button>}
    </header>

    <nav aria-label="Sections du serveur" className="flex gap-1 border-b">
      {([ ["console", "Console", TerminalSquare], ["files", "Fichiers", File], ["databases", "Bases de données", Database] ] as const).map(([key, label, Icon]) =>
        <Link key={key} to={serverSectionRoute(panel?.id ?? requestedPanel ?? "", identifier, key)} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${section === key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="size-4" />{label}</Link>)}
    </nav>

    {!panel && panels.isSuccess && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Ce panel n’est pas configuré. Retournez à la liste et sélectionnez un compte.</p>}
    {panel && !server && servers.isSuccess && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Ce serveur n’est pas accessible depuis le panel sélectionné.</p>}
    {section === "files" && <div className="grid min-h-[min(68vh,720px)] gap-3 lg:grid-cols-[minmax(250px,340px)_1fr]">
      <aside className="overflow-hidden rounded-xl border bg-card">
        <div className="space-y-3 border-b px-4 py-3">
          <div><p className="text-sm font-semibold">Parcourir les fichiers</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{path}</p></div>
          <label className="relative block"><Search aria-hidden="true" className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><input value={fileFilter} onChange={event => setFileFilter(event.target.value)} placeholder="Filtrer ce dossier…" aria-label="Filtrer les fichiers du dossier courant" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"/></label>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ArrowDownAZ className="size-3.5"/>Dossiers puis nom</span>
            <button type="button" onClick={() => setShowHidden(value => !value)} aria-pressed={showHidden} className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-secondary hover:text-foreground">{showHidden ? <Eye className="size-3.5"/> : <EyeOff className="size-3.5"/>}{showHidden ? "Masqués visibles" : "Afficher les masqués"}</button>
          </div>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-2">
          {path !== "/" && <button onClick={() => { const parent = path.split("/").slice(0,-1).join("/") || "/"; setPath(parent); setSelected(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">↰ Dossier parent</button>}
          {files.isLoading && <p className="p-3 text-sm text-muted-foreground">Chargement du dossier…</p>}
          {files.isError && <p role="alert" className="p-3 text-sm text-destructive">{errorMessage(files.error)}</p>}
          {visibleFiles.map(entry => entry.kind === "directory" ? <button key={entry.path} onClick={() => { setPath(entry.path); setSelected(null); setFileFilter(""); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"><Folder className="size-4 text-amber-500" /><span className="min-w-0 flex-1 truncate">{entry.name}</span><ChevronRight className="size-4 text-muted-foreground" /></button> : <button key={entry.path} onClick={() => setSelected(entry.path)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${selected === entry.path ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}><File className="size-4" /><span className="min-w-0 flex-1 truncate">{entry.name}</span><span className="text-xs text-muted-foreground">{entry.size == null ? "" : `${(entry.size / 1024).toFixed(1)} Ko`}</span></button>)}
          {files.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Ce dossier est vide.</p>}
          {files.data && files.data.length > 0 && visibleFiles.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun fichier ne correspond dans ce dossier.</p>}
        </div>
      </aside>
      <article className="min-h-[420px] overflow-hidden rounded-xl border bg-card">
        <div className="flex min-w-0 items-center gap-1 border-b px-4 py-3 text-sm">{breadcrumbs.map((part, index) => <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1"><button className="truncate hover:underline" onClick={() => { setPath(`/${breadcrumbs.slice(0,index+1).join("/")}`); setSelected(null); }}>{part}</button>{index < breadcrumbs.length - 1 && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}</span>)}{!breadcrumbs.length && <span className="text-muted-foreground">Racine du serveur</span>}</div>
        {selected ? <><div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">{selected}</div>{content.isLoading ? <p className="p-5 text-sm text-muted-foreground">Lecture du fichier…</p> : content.isError ? <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(content.error)}</p> : <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5">{content.data}</pre>}</> : <div className="grid h-[min(60vh,620px)] place-content-center text-center"><File className="mx-auto mb-3 size-8 text-muted-foreground"/><p className="font-medium">Aucun fichier ouvert</p><p className="mt-1 text-sm text-muted-foreground">Choisissez un fichier lisible dans la liste.</p></div>}
      </article>
    </div>}

    {section === "databases" && <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-4 border-b bg-secondary/25 px-5 py-4"><div className="min-w-52 flex-1"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Bases de données</h2><p className="mt-1 text-sm text-muted-foreground">{databases.data?.length ?? (databases.isLoading ? "…" : "0")} utilisée(s) sur {databaseLimit ?? "quota inconnu"}</p></div>{databaseLimit != null && <span className="font-mono text-sm tabular-nums">{databaseCount}/{databaseLimit}</span>}</div>{databaseUsage != null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Utilisation du quota de bases de données" aria-valuemin={0} aria-valuemax={databaseLimit || 1} aria-valuenow={Math.min(databaseCount, databaseLimit ?? 0)}><div className={`h-full rounded-full transition-all ${databaseUsage >= 100 ? "bg-destructive" : databaseUsage >= 80 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${databaseUsage}%` }}/></div>}</div></div>
      {databases.data && databaseLimit != null && databaseLimit > 0 && databaseCount >= databaseLimit && <p className="border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">Le quota est atteint. Pour ajouter une base, augmentez la limite depuis le panel.</p>}
      {databases.isLoading && <p className="p-6 text-sm text-muted-foreground">Chargement des bases…</p>}
      {databases.isError && <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(databases.error)}</p>}
      {databases.data?.length ? <div className="divide-y">{databases.data.map(database => {
        const revealed = revealedPasswords.includes(database.id);
        const detail = (label: string, value?: string | null, secret = false) => <div className="min-w-0 rounded-lg border bg-background/50 p-3">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 break-all font-mono text-xs leading-5">{!value ? <span className="text-muted-foreground">Non exposé par l’API</span> : secret && !revealed ? "••••••••••••••••" : value}</span>
            {secret && value && <button type="button" aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setRevealedPasswords(current => revealed ? current.filter(id => id !== database.id) : [...current, database.id])} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">{revealed ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button>}
            {value && !secret && <button type="button" aria-label={`Copier ${label.toLocaleLowerCase()}`} onClick={() => void copyValue(value, label)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Copy className="size-3.5"/></button>}
          </dd>
        </div>;
        return <article key={database.id} className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-semibold">{database.name}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">ID · {database.id}</p></div>{database.phpmyadmin_url && <Button variant="outline" size="sm" asChild><a href={database.phpmyadmin_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4"/>PHPMyAdmin</a></Button>}</div>
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">{detail("Utilisateur", database.username)}{detail("Mot de passe", database.password, true)}{detail("Connexion", database.host)}{detail("Connexions autorisées", database.connections_from)}{detail("Chaîne JDBC", database.jdbc_connection_string)}</dl>
        </article>;
      })}</div> : databases.data && <div className="grid min-h-72 place-content-center px-5 text-center"><Database className="mx-auto mb-3 size-8 text-muted-foreground"/><p className="font-medium">Aucune base de données</p><p className="mt-1 text-sm text-muted-foreground">Les informations de quota restent liées à ce serveur.</p></div>}
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">Les champs marqués « Non exposé par l’API » ne sont pas retournés par le panel. Création, suppression et rotation seront activées après validation du contrat WISP compatible.</p>
    </section>}
  </section>;
}
