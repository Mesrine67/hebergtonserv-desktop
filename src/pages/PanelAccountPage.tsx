import { useQuery } from "@tanstack/react-query";
import { ExternalLink, KeyRound, RefreshCw, Server, ShieldCheck, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionCard, selectStyles } from "@/components/page-shell";
import { commands } from "@/lib/tauri";
import { resolvePanel, serverListRoute } from "@/lib/panel-navigation";
import { errorMessage } from "@/lib/error-message";

export default function PanelAccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("panel");
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = resolvePanel(panels.data, requestedId);
  const account = useQuery({
    queryKey: ["panel-account", panel?.id],
    queryFn: () => commands.getPanelAccount(panel!.id),
    enabled: Boolean(panel),
    retry: 1,
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Infrastructure · Authentification" title="Compte du panel"
        description="Inspectez le compte Client API actif et ses permissions sans afficher les identifiants de connexion."
        action={panel ? (
          <Button variant="outline" onClick={() => void account.refetch()} disabled={account.isFetching}>
            <RefreshCw className={"mr-2 size-4 " + (account.isFetching ? "animate-spin" : "")} />Actualiser
          </Button>
        ) : undefined} />
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <label htmlFor="account-panel-select" className="text-xs font-medium text-muted-foreground">Panel actif</label>
          <select id="account-panel-select" className={selectStyles + " min-w-60 max-w-full"}
            value={panel?.id ?? ""}
            onChange={event => setSearchParams({ panel: event.target.value })} disabled={!panels.data?.length}>
            {!panel && <option value="">Choisir un panel</option>}
            {(panels.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.provider}</option>)}
          </select>
        </div>
        {panel && <span className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium " +
          (panel.status === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "bg-secondary text-muted-foreground")}>
          <span className={"size-1.5 rounded-full " + (panel.status === "ok" ? "bg-emerald-500" : "bg-muted-foreground")} />
          {panel.status === "ok" ? "Connexion vérifiée" : "Vérification requise"}
        </span>}
      </div>
      {panels.isPending ? <p role="status" className="text-sm text-muted-foreground">Chargement des panels…</p>
        : panels.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(panels.error)}</p>
        : !panel ? (
          <EmptyState message={requestedId ? "Ce panel n’existe plus. Choisissez une autre connexion." : "Aucun panel configuré. Ajoutez un panel pour continuer."} />
        ) : <SectionCard title={panel.name} description={panel.provider.toUpperCase() + " · " + panel.base_url}>
          {account.isPending ? <p role="status" className="text-sm text-muted-foreground">Vérification de l’API Client…</p>
            : account.isError ? (
              <div role="alert" className="space-y-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{errorMessage(account.error)}</p>
                <Button variant="outline" size="sm" onClick={() => void account.refetch()}>Réessayer</Button>
              </div>
            ) : account.data && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg border bg-secondary/20 p-4">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10"><UserRound className="size-5 text-primary" /></div>
                    <div className="min-w-0"><p className="text-xs text-muted-foreground">Compte connecté</p><p className="truncate font-semibold">{account.data.account.display_name}</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border bg-secondary/20 p-4">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10"><ShieldCheck className="size-5 text-emerald-500" /></div>
                    <div className="min-w-0"><p className="text-xs text-muted-foreground">Authentification de l’application</p><p className="text-sm font-semibold">Client API · Bearer HTTPS</p></div>
                  </div>
                  <div className="min-w-0 rounded-lg border p-4"><p className="text-xs text-muted-foreground">Adresse e-mail</p><p className="mt-1 break-all text-sm font-medium">{account.data.account.email || "Non fournie par l’API"}</p></div>
                  <div className="min-w-0 rounded-lg border p-4"><p className="text-xs text-muted-foreground">Identifiant</p><p className="mt-1 break-all font-mono text-sm">{account.data.account.username && account.data.account.username !== "0" ? account.data.account.username : account.data.account.id > 0 ? account.data.account.id : "Non communiqué par le panel"}</p></div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border bg-secondary/25 p-3 text-xs leading-relaxed text-muted-foreground">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>L’application utilise actuellement une clé Client API, et non le mot de passe de votre compte. La connexion e-mail/mot de passe du site fonctionne avec une session et des contrôles CSRF/2FA distincts. Aucun mot de passe n’est enregistré ici.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild><Link to={serverListRoute(panel.id)}><Server className="mr-2 size-4" />Afficher les serveurs</Link></Button>
                  <Button variant="outline" asChild><a href={panel.base_url} target="_blank" rel="noopener noreferrer">Ouvrir la connexion web <ExternalLink className="ml-2 size-3.5" /></a></Button>
                  <Button variant="secondary" asChild><Link to="/panels">Gérer les panels</Link></Button>
                </div>
              </div>
            )}
        </SectionCard>}
    </div>
  );
}
