import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionCard } from "@/components/page-shell";
import { commands } from "@/lib/tauri";

export default function PanelAccountPage() {
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = panels.data?.find((item) => item.status === "ok") ?? panels.data?.[0];
  const account = useQuery({ queryKey: ["panel-account", panel?.id], queryFn: () => commands.getPanelAccount(panel!.id), enabled: Boolean(panel) });
  return <div className="space-y-6">
    <PageHeader eyebrow="Infrastructure · Authentication" title="Compte du panel" description="Vérifiez le compte authentifié et l’API Client active pour WISP ou Pterodactyl." action={panel ? <Button variant="outline" onClick={() => void account.refetch()} disabled={account.isFetching}><RefreshCw className={`mr-2 size-4 ${account.isFetching ? "animate-spin" : ""}`} />Actualiser</Button> : undefined} />
    {!panel ? <EmptyState message="Aucun panel configuré. Ajoutez un panel pour continuer." /> : <SectionCard title={panel.name} description={`${panel.provider} · ${panel.base_url}`}>
      {account.isPending ? <p className="text-sm text-muted-foreground">Vérification de l’API Client…</p> : account.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{String(account.error)}</p><Button variant="outline" onClick={() => void account.refetch()}>Réessayer</Button></div> : account.data && <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border p-4"><UserRound className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Compte</p><p className="font-medium">{account.data.account.display_name}</p></div></div>
        <div className="flex items-center gap-3 rounded-lg border p-4"><ShieldCheck className="size-5 text-emerald-500" /><div><p className="text-xs text-muted-foreground">Authentification</p><p className="font-medium">Bearer HTTPS · {account.data.provider}</p></div></div>
        <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Adresse e-mail</p><p className="mt-1 font-medium">{account.data.account.email || "Non fournie par l’API"}</p></div>
        <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Identifiant</p><p className="mt-1 font-mono text-sm">{account.data.account.username || account.data.account.id}</p></div>
        <div className="sm:col-span-2 flex flex-wrap gap-2"><Button asChild><Link to="/panel/servers">Afficher les serveurs</Link></Button><Button variant="outline" asChild><a href={panel.base_url} target="_blank" rel="noreferrer">Ouvrir le panel <ExternalLink className="ml-2 size-3.5" /></a></Button></div>
      </div>}
    </SectionCard>}
  </div>;
}
