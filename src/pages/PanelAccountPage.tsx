import { useQuery } from "@tanstack/react-query";
import { Activity, ExternalLink, KeyRound, RefreshCw, Server, ShieldCheck, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { commands } from "@/lib/tauri";
import { resolvePanel, serverListRoute } from "@/lib/panel-navigation";
import { errorMessage } from "@/lib/error-message";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function PanelAccountDetails({ panel }: { panel: NonNullable<ReturnType<typeof resolvePanel>> }) {
  const account = useQuery({ queryKey: ["panel-account", panel.id], queryFn: () => commands.getPanelAccount(panel.id), retry: 1 });
  const servers = useQuery({ queryKey: ["panel-servers", panel.id], queryFn: () => commands.listPanelServers(panel.id), retry: 1 });
  const capabilities = useQuery({ queryKey: ["panel-capabilities", panel.id], queryFn: () => commands.checkPanel(panel.id), retry: 0, staleTime: 60_000 });
  const checkedAt = panel.last_checked_at ? new Date(panel.last_checked_at) : null;
  const checkedLabel = checkedAt && !Number.isNaN(checkedAt.getTime()) ? dateFormatter.format(checkedAt) : "Aucune vérification enregistrée";
  const currentStatus = account.isPending ? "Vérification…" : account.isError ? "Connexion indisponible" : "Connexion vérifiée";
  const currentStatusColor = account.isPending ? "bg-amber-500" : account.isError ? "bg-destructive" : "bg-emerald-500";
  const serverError = servers.isError ? errorMessage(servers.error) : "";
  const serverEndpointMissing = /\b404\b|endpoint.*(absent|introuvable|non exposé)/i.test(serverError);
  const serverStatusLabel = servers.isPending ? "Lecture…" : servers.isError ? serverEndpointMissing ? "Endpoint indisponible" : "Erreur de lecture" : `${servers.data?.length ?? 0} serveur${servers.data?.length === 1 ? "" : "s"}`;
  const serverStatusDetail = servers.isError ? serverEndpointMissing ? "L’API Client n’expose pas la route de liste des serveurs attendue." : serverError : `${servers.data?.length ?? 0} serveur(s) accessibles avec ce jeton.`;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">État du panel</p><p className="mt-2 flex items-center gap-2 font-semibold"><span className={`size-2 rounded-full ${currentStatusColor}`} />{currentStatus}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Serveurs accessibles</p><p className="mt-2 font-semibold">{serverStatusLabel}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Contrat API</p><p className="mt-2 font-semibold">{panel.provider === "wisp" ? panel.pterodactyl_version === "wisp-v2-experimental" ? "WISP v2 · expérimental" : "WISP Client API" : `Pterodactyl ${panel.pterodactyl_version || "Client API"}`}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Dernière vérification</p><p className="mt-2 flex items-center gap-2 text-sm font-medium"><Activity className="size-4 text-primary" />{checkedLabel}</p></div>
      </div>

      {account.isPending ? <p role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Lecture du profil depuis l’API Client…</p>
        : account.isError ? <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-5"><p className="text-sm text-destructive">{errorMessage(account.error)}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void account.refetch()}>Réessayer</Button></div>
          : account.data && <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-3 border-b px-5 py-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></span><div className="min-w-0"><h2 className="truncate font-semibold">{account.data.account.display_name}</h2><p className="text-xs text-muted-foreground">Profil renvoyé par l’API {account.data.provider.toUpperCase()}</p></div><span className="ml-auto rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">{account.data.account.admin ? "Administrateur" : "Compte client"}</span></div>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              {[{ label: "E-mail", value: account.data.account.email || "Non communiqué" }, { label: "Nom d’utilisateur", value: account.data.account.username || "Non communiqué" }, { label: "Identifiant panel", value: account.data.account.id > 0 ? String(account.data.account.id) : "Non communiqué" }, { label: "Connexion", value: "Jeton Client API · HTTPS" }].map(item => <div key={item.label} className="min-w-0 bg-card px-5 py-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 break-all text-sm font-medium">{item.value}</p></div>)}
            </div>
          </section>}

      {!account.isPending && !account.isError && account.data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-emerald-500" /><span>API Client authentifiée · {account.data.provider.toUpperCase()}</span></div>
          <Button size="sm" variant="outline" onClick={() => { void account.refetch(); void servers.refetch(); void capabilities.refetch(); }} disabled={account.isFetching || servers.isFetching || capabilities.isFetching}><RefreshCw className={`mr-2 size-4 ${account.isFetching || servers.isFetching || capabilities.isFetching ? "animate-spin" : ""}`} />Actualiser les données</Button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-semibold">Serveurs associés</h2><p className="mt-1 text-xs text-muted-foreground">Ressources accessibles avec ce jeton Client API.</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs tabular-nums">{servers.isPending ? "…" : servers.data?.length ?? 0}</span></div>
        {servers.isPending ? <p className="p-5 text-sm text-muted-foreground">Lecture de la liste des serveurs…</p> : servers.isError ? <p role="alert" className="p-5 text-sm text-destructive">{errorMessage(servers.error)}</p> : !servers.data?.length ? <p className="p-5 text-sm text-muted-foreground">Aucun serveur accessible avec ce jeton.</p> : <ul className="divide-y">{servers.data.map(server => <li key={server.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><Server className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{server.name}</span><span className="text-xs text-muted-foreground">{server.identifier}</span>{server.suspended && <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-600">Suspendu</span>}<Button size="sm" variant="ghost" asChild><Link to={serverListRoute(panel.id)}>Voir les serveurs</Link></Button></li>)}</ul>}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-semibold">Accès API disponibles</h2><p className="mt-1 text-xs text-muted-foreground">Capacités testées avec le jeton actuel ; les fonctions absentes restent gérées dans le site du panel.</p></div>{capabilities.isFetching && <span className="text-xs text-muted-foreground">Vérification…</span>}</div>
        <div className="divide-y">
          {[{ label: "Profil Client API", supported: account.data ? true : account.isError ? false : null, detail: account.data ? "Identité du compte lue avec succès." : account.isError ? errorMessage(account.error) : "Lecture du profil en cours." }, { label: "Liste des serveurs", supported: servers.data ? true : servers.isError ? false : null, detail: servers.isError ? serverStatusDetail : `${servers.data?.length ?? 0} serveur(s) accessibles avec ce jeton.` }, { label: "Gestion des clés API", supported: capabilities.data?.api_keys_supported ?? null, detail: capabilities.data ? capabilities.data.api_keys_supported ? "Endpoint de clés disponible sur ce panel." : "Non exposée par l’API publique de cette instance ; gérez les clés sur le site du panel." : capabilities.isError ? errorMessage(capabilities.error) : "Détection de la capacité…" }, { label: "Gestion des clés SSH", supported: capabilities.data?.ssh_keys_supported ?? null, detail: capabilities.data ? capabilities.data.ssh_keys_supported ? "Endpoint de clés disponible sur ce panel." : "Non exposée par l’API publique de cette instance ; gérez les clés sur le site du panel." : capabilities.isError ? errorMessage(capabilities.error) : "Détection de la capacité…" }].map(item => <div key={item.label} className="flex items-start gap-3 px-5 py-3.5"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.supported === true ? "bg-emerald-500" : item.supported === false ? "bg-destructive" : "animate-pulse bg-amber-500"}`} /><div className="min-w-0"><p className="text-sm font-medium">{item.label}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.detail}</p></div><span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{item.supported === true ? "Disponible" : item.supported === false ? "Indisponible" : "À vérifier"}</span></div>)}
        </div>
      </section>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-primary/15 bg-primary/[0.035] p-4">
        <div className="flex min-w-0 gap-3"><KeyRound className="mt-0.5 size-4 shrink-0 text-primary" /><p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">Le client utilise le jeton Client API enregistré dans le coffre sécurisé Windows. Il ne lit pas la session du navigateur et ne peut pas afficher le mot de passe du compte. Certaines opérations de sécurité WISP ne sont pas disponibles via l’API documentée.</p></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" asChild><Link to={serverListRoute(panel.id)}><Server className="mr-2 size-4" />Voir les serveurs</Link></Button><Button size="sm" variant="outline" asChild><a href={panel.base_url} target="_blank" rel="noopener noreferrer">Ouvrir le panel <ExternalLink className="ml-2 size-3.5" /></a></Button><Button size="sm" variant="outline" asChild><Link to="/panels"><ShieldCheck className="mr-2 size-4" />Connexion et jeton</Link></Button></div>
      </div>
    </div>
  );
}

export default function PanelAccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("panel");
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = resolvePanel(panels.data, requestedId);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Infrastructure · Accès Client API" title="Compte du panel" description="Profil connecté, état des accès et ressources visibles pour le jeton de ce panel." />
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div className="space-y-1"><label id="account-panel-select-label" className="text-xs font-medium text-muted-foreground">Connexion panel</label><Select value={panel?.id ?? ""} onValueChange={value => setSearchParams({ panel: value })} disabled={!panels.data?.length}><SelectTrigger aria-labelledby="account-panel-select-label" className="min-w-60 max-w-full"><SelectValue placeholder="Choisir un panel"/></SelectTrigger><SelectContent>{(panels.data ?? []).map(item => <SelectItem key={item.id} value={item.id}>{item.name} · {item.provider}</SelectItem>)}</SelectContent></Select></div>
        {panel && <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${panel.status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "bg-secondary text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${panel.status === "ok" ? "bg-emerald-500" : "bg-muted-foreground"}`} />{panel.status === "ok" ? "Vérifié" : "À vérifier"}</span>}
      </div>
      {panels.isPending ? <p role="status" className="text-sm text-muted-foreground">Chargement des panels…</p> : panels.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(panels.error)}</p> : !panel ? <EmptyState message={requestedId ? "Ce panel n’existe plus. Choisissez une autre connexion." : "Aucun panel configuré. Ajoutez une connexion pour continuer."} /> : <PanelAccountDetails key={panel.id} panel={panel} />}
    </div>
  );
}
