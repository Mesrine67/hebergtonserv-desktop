import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownAZ, ChevronRight, Copy, Database, Eye, EyeOff, ExternalLink, File, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { PanelFileTree } from "@/components/panel-file-tree";
import { ServerCodeEditor } from "@/components/server-code-editor";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { commands } from "@/lib/tauri";
import { resolvePanel, serverListRoute } from "@/lib/panel-navigation";
import { clearServerFileDraft, getServerExplorerState, getServerFileDraft, setServerExplorerState, setServerFileDraft } from "@/lib/server-file-draft-cache";

type Section = "files" | "databases";
function apiIdentifier(provider: string, version: string, id: string, identifier: string) {
  // WISP panels expose Client API server routes by their short server identifier,
  // matching the identifier used by their own /server/{identifier}/... pages.
  if (provider.toLowerCase() === "wisp") return identifier;
  return /^v?2(\.|$)/.test(version) ? id : identifier;
}
export default function ServerManagementPage({ section }: { section: Section }) {
  const queryClient = useQueryClient();
  const { identifier = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
  const filesFetching = useIsFetching({ queryKey: ["panel-server-files", panel?.id, requestId] }) > 0;
  const content = useQuery({ queryKey: ["panel-server-file", panel?.id, requestId, selected], queryFn: () => commands.readPanelServerFile(panel!.id, requestId, selected!), enabled: Boolean(panel && requestId && selected && section === "files"), staleTime: 0 });
  const [draftByFile, setDraftByFile] = useState<Record<string, string>>({});
  const [savingFile, setSavingFile] = useState(false);
  const original = content.data ?? "";
  const cachedDraft = panel && server && selected ? getServerFileDraft(panel.id, server.identifier, selected) : undefined;
  const draft = selected && Object.prototype.hasOwnProperty.call(draftByFile, selected)
    ? draftByFile[selected] : cachedDraft ?? original;
  const dirty = Boolean(selected && content.isSuccess && draft !== original);
  const announceDraftState = (isDirty: boolean) => {
    if (!panel || !server) return;
    window.dispatchEvent(new CustomEvent("hts:file-explorer-draft-change", {
      detail: { panelId: panel.id, serverIdentifier: server.identifier, dirty: isDirty },
    }));
  };
  const saveFile = async () => {
    if (!panel || !server || !requestId || !selected || !dirty || savingFile || !content.isSuccess) return;
    if (new TextEncoder().encode(draft).length > 1024 * 1024) {
      toast.error("Le fichier dépasse la taille maximale de 1 Mio de l'éditeur.");
      return;
    }
    setSavingFile(true);
    try {
      // Prevent silently overwriting changes made in WISP or by another editor.
      const latest = await commands.readPanelServerFile(panel.id, requestId, selected);
      if (latest !== original) {
        toast.warning("Le fichier a changé sur le serveur. Vérifiez les modifications avant de réessayer.");
        await queryClient.invalidateQueries({ queryKey: ["panel-server-file", panel.id, requestId, selected] });
        return;
      }
      await commands.writePanelServerFile(panel.id, requestId, selected, draft);
      queryClient.setQueryData(["panel-server-file", panel.id, requestId, selected], draft);
      clearServerFileDraft(panel.id, server.identifier, selected);
      announceDraftState(false);
      setDraftByFile(previous => {
        const next = { ...previous };
        delete next[selected];
        return next;
      });
      toast.success("Fichier enregistré sur le serveur.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingFile(false);
    }
  };
  const databases = useQuery({ queryKey: ["panel-server-databases", panel?.id, requestId], queryFn: () => commands.listPanelServerDatabases(panel!.id, requestId), enabled: Boolean(panel && requestId && section === "databases"), staleTime: 15_000 });
  const breadcrumbs = useMemo(() => path.split("/").filter(Boolean), [path]);
  const databaseCount = databases.data?.length ?? 0;
  const databaseLimit = server?.limits.databases;
  const databaseUsage = databaseLimit == null ? null : Math.min(100, databaseLimit === 0 ? 100 : databaseCount / databaseLimit * 100);
  const [revealedPasswords, setRevealedPasswords] = useState<string[]>([]);
  const [fileExplorerLayout, setFileExplorerLayout] = useState<Record<string, number>>(() => {
    try {
      const saved = window.localStorage.getItem("hts-server-files-layout");
      const layout = saved ? JSON.parse(saved) as Record<string, number> : null;
      return layout && Number.isFinite(layout.explorer) && Number.isFinite(layout.editor)
        ? layout : { explorer: 24, editor: 76 };
    } catch {
      return { explorer: 24, editor: 76 };
    }
  });
  const copyValue = async (value: string, label: string) => {
    try { if (isTauri()) await writeText(value); else await navigator.clipboard.writeText(value); toast.success(`${label} copié.`); }
    catch { toast.error(`Impossible de copier ${label.toLocaleLowerCase()}.`); }
  };

  useEffect(() => {
    if (section !== "files" || !panel || !server) return;
    window.dispatchEvent(new CustomEvent("hts:file-explorer-open", {
      detail: { panelId: panel.id, serverIdentifier: server.identifier, label: server.name },
    }));
  }, [section, panel?.id, server?.identifier, server?.name]);

  useEffect(() => {
    if (section !== "files" || !panel || !server || selected) return;
    const cached = getServerExplorerState(panel.id, server.identifier);
    if (cached?.selected) {
      setSelected(cached.selected);
      setPath(cached.path);
    }
  }, [section, panel?.id, server?.identifier, selected]);

  return <section className={section === "files" ? "flex min-h-0 flex-1 flex-col" : "space-y-4"}>

    {!panel && panels.isSuccess && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Ce panel n’est pas configuré. Retournez à la liste et sélectionnez un compte.</p>}
    {panel && !server && servers.isSuccess && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Ce serveur n’est pas accessible depuis le panel sélectionné.</p>}
    {section === "files" && <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 overflow-hidden rounded-xl" defaultLayout={fileExplorerLayout} onLayoutChange={layout => {
      const next = { explorer: layout.explorer ?? 24, editor: layout.editor ?? 76 };
      setFileExplorerLayout(next);
      try { window.localStorage.setItem("hts-server-files-layout", JSON.stringify(next)); } catch { /* storage can be disabled */ }
    }}>
      <ResizablePanel id="explorer" defaultSize="24%" minSize="16%" maxSize="42%" className="min-h-0 min-w-0">
      <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="space-y-3 border-b px-4 py-3">
          <div><p className="text-sm font-semibold">Parcourir les fichiers</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{path}</p></div>
          <label className="relative block"><Search aria-hidden="true" className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><input value={fileFilter} onChange={event => setFileFilter(event.target.value)} placeholder="Filtrer les dossiers ouverts…" aria-label="Filtrer les fichiers des dossiers ouverts" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"/></label>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ArrowDownAZ className="size-3.5"/>Dossiers puis nom</span>
            <button type="button" onClick={() => setShowHidden(value => !value)} aria-pressed={showHidden} className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-secondary hover:text-foreground">{showHidden ? <Eye className="size-3.5"/> : <EyeOff className="size-3.5"/>}{showHidden ? "Masqués visibles" : "Afficher les masqués"}</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {panel && requestId && <PanelFileTree key={`${panel.id}:${requestId}`} panelId={panel.id} serverId={requestId} path="/" selected={selected} filter={fileFilter} showHidden={showHidden} onSelect={entry => {
            const nextPath = entry.path.split("/").slice(0, -1).join("/") || "/";
            setSelected(entry.path);
            setPath(nextPath);
            setServerExplorerState(panel.id, server!.identifier, { selected: entry.path, path: nextPath });
          }}/>}
        </div>
      </aside>
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="Redimensionner l’arborescence et l’éditeur" />
      <ResizablePanel id="editor" defaultSize="76%" minSize="38%" className="min-h-0 min-w-0">
      <article className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex min-w-0 items-center gap-1 border-b px-4 py-3 text-sm">{breadcrumbs.map((part, index) => <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1"><span className="truncate">{part}</span>{index < breadcrumbs.length - 1 && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}</span>)}{!breadcrumbs.length && <span className="text-muted-foreground">Racine du serveur</span>}</div>
        {selected ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3">
            <div className="shrink-0 truncate py-2 font-mono text-xs text-muted-foreground" title={selected}>{selected}</div>
            {content.isLoading ? <p role="status" className="p-5 text-sm text-muted-foreground">Lecture du fichier…</p>
              : content.isError ? <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(content.error)}</p>
              : content.isSuccess ? (
                <ServerCodeEditor
                  key={selected}
                  path={selected}
                  value={draft}
                  original={original}
                  onChange={value => {
                    setDraftByFile(previous => ({ ...previous, [selected]: value }));
                    if (value === original) clearServerFileDraft(panel!.id, server!.identifier, selected);
                    else setServerFileDraft(panel!.id, server!.identifier, selected, value);
                    setServerExplorerState(panel!.id, server!.identifier, { selected, path });
                    announceDraftState(value !== original);
                  }}
                  onSave={() => void saveFile()}
                  saving={savingFile}
                  refreshing={filesFetching}
                  onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["panel-server-files", panel?.id, requestId] })}
                />
              ) : null}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 place-content-center text-center">
            <File className="mx-auto mb-3 size-8 text-muted-foreground"/>
            <p className="font-medium">Aucun fichier ouvert</p>
            <p className="mt-1 text-sm text-muted-foreground">Choisissez un fichier lisible dans l'arborescence.</p>
          </div>
        )}
      </article>
      </ResizablePanel>
    </ResizablePanelGroup>}

    {section === "databases" && <FloatingPanel open onOpenChange={open => { if (!open) navigate(serverListRoute(requestedPanel ?? panel?.id ?? null)); }} title={<span className="flex items-center gap-2"><Database className="size-5 text-primary"/>Bases de données · {server?.name ?? "Serveur"}</span>} description="Informations de connexion et quota des bases de données du serveur." className="max-h-[86dvh] w-[min(94vw,1120px)]">
      <div className="flex shrink-0 justify-end px-5 pt-3"><Button variant="outline" size="sm" onClick={() => void databases.refetch()} disabled={databases.isFetching}><RefreshCw className={`mr-2 size-4 ${databases.isFetching ? "animate-spin" : ""}`} />Actualiser</Button></div>
      <section className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-4 border-b bg-secondary/25 px-5 py-4"><div className="min-w-52 flex-1"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Bases de données</h2><p className="mt-1 text-sm text-muted-foreground">{databases.data?.length ?? (databases.isLoading ? "…" : "0")} utilisée(s) sur {databaseLimit ?? "quota inconnu"}</p></div>{databaseLimit != null && <span className="font-mono text-sm tabular-nums">{databaseCount}/{databaseLimit}</span>}</div>{databaseUsage != null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Utilisation du quota de bases de données" aria-valuemin={0} aria-valuemax={databaseLimit || 1} aria-valuenow={Math.min(databaseCount, databaseLimit ?? 0)}><div className={`h-full rounded-full transition-all ${databaseUsage >= 100 ? "bg-destructive" : databaseUsage >= 80 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${databaseUsage}%` }}/></div>}</div></div>
      {databases.data && databaseLimit != null && databaseLimit > 0 && databaseCount >= databaseLimit && <p className="border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">Le quota est atteint. Pour ajouter une base, augmentez la limite depuis le panel.</p>}
      {databases.isLoading && <p className="p-6 text-sm text-muted-foreground">Chargement des bases…</p>}
      {databases.isError && <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(databases.error)}</p>}
      {databases.data?.length ? <div className="divide-y">{databases.data.map(database => {
        const detail = (label: string, value?: string | null, secret = false) => {
          const secretId = `${database.id}:${label}`;
          const revealed = revealedPasswords.includes(secretId);
          return <div className="min-w-0 rounded-lg border bg-background/50 p-3">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 break-all font-mono text-xs leading-5">{!value ? <span className="text-muted-foreground">Non exposé par l’API</span> : secret && !revealed ? "••••••••••••••••" : value}</span>
            {secret && value && <button type="button" aria-label={`${revealed ? "Masquer" : "Afficher"} ${label.toLocaleLowerCase()}`} onClick={() => setRevealedPasswords(current => revealed ? current.filter(id => id !== secretId) : [...current, secretId])} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">{revealed ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}</button>}
            {value && !secret && <button type="button" aria-label={`Copier ${label.toLocaleLowerCase()}`} onClick={() => void copyValue(value, label)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Copy className="size-3.5"/></button>}
          </dd>
        </div>;
        };
        return <article key={database.id} className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-semibold">{database.name}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">ID · {database.id}</p></div>{database.phpmyadmin_url && <Button variant="outline" size="sm" asChild><a href={database.phpmyadmin_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4"/>PHPMyAdmin</a></Button>}</div>
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">{detail("Utilisateur", database.username)}{detail("Mot de passe", database.password, true)}{detail("Connexion", database.host)}{detail("Connexions autorisées", database.connections_from)}{detail("Chaîne JDBC", database.jdbc_connection_string, true)}</dl>
        </article>;
      })}</div> : databases.data && <div className="grid min-h-72 place-content-center px-5 text-center"><Database className="mx-auto mb-3 size-8 text-muted-foreground"/><p className="font-medium">Aucune base de données</p><p className="mt-1 text-sm text-muted-foreground">Les informations de quota restent liées à ce serveur.</p></div>}
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">Les champs marqués « Non exposé par l’API » ne sont pas retournés par le panel. Création, suppression et rotation seront activées après validation du contrat WISP compatible.</p>
      </section>
    </FloatingPanel>}
  </section>;
}
