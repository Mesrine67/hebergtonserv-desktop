import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Server } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, SectionCard } from "@/components/page-shell";
import { commands } from "@/lib/tauri";

function limit(value?: number | null, unit = " Mo") { return value == null || value < 0 ? "Illimité" : `${value}${unit}`; }

export default function PanelServersPage() {
  const [search, setSearch] = useState("");
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const panel = panels.data?.find((item) => item.status === "ok") ?? panels.data?.[0];
  const servers = useQuery({ queryKey: ["panel-servers", panel?.id], queryFn: () => commands.listPanelServers(panel!.id), enabled: Boolean(panel) });
  const visible = (servers.data ?? []).filter((server) => `${server.name} ${server.identifier} ${server.node ?? ""} ${server.egg ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <PageHeader eyebrow="Infrastructure · Client API" title="Serveurs" description="Serveurs autorisés pour le compte connecté. La liste suit la pagination WISP/Pterodactyl et peut être actualisée à la demande." action={panel ? <Button variant="outline" onClick={() => void servers.refetch()} disabled={servers.isFetching}><RefreshCw className={`mr-2 size-4 ${servers.isFetching ? "animate-spin" : ""}`} />Actualiser</Button> : undefined} />
    {!panel ? <EmptyState message="Aucun panel configuré. Ajoutez un panel puis connectez-vous." /> : <SectionCard title={`${panel.name} · ${panel.provider}`} description={servers.data ? `${servers.data.length} serveur(s) accessibles` : panel.base_url}>
      {servers.data && servers.data.length > 0 && <Input className="mb-4" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un serveur, un identifiant ou un node…" />}
      {servers.isPending ? <p className="text-sm text-muted-foreground">Chargement des serveurs depuis l’API Client…</p> : servers.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{String(servers.error)}</p><Button variant="outline" onClick={() => void servers.refetch()}>Réessayer</Button></div> : visible.length === 0 ? <EmptyState message={servers.data?.length ? "Aucun serveur ne correspond à la recherche." : "Aucun serveur n’est associé à ce compte panel."} /> : <div className="grid gap-3 lg:grid-cols-2">{visible.map((server) => <article key={server.id} className="rounded-lg border p-4">
        <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><Server className="size-5 text-primary" /></div><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{server.name}</h2><p className="truncate font-mono text-xs text-muted-foreground">{server.identifier}</p></div>{server.status && <span className="rounded-full border px-2 py-1 text-[11px]">{server.status}</span>}</div>
        {server.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{server.description}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div className="rounded bg-secondary/60 p-2"><dt className="text-muted-foreground">Node</dt><dd className="mt-1 truncate font-medium">{server.node ?? "—"}</dd></div><div className="rounded bg-secondary/60 p-2"><dt className="text-muted-foreground">Jeu / egg</dt><dd className="mt-1 truncate font-medium">{server.egg ?? "—"}</dd></div><div className="rounded bg-secondary/60 p-2"><dt className="text-muted-foreground">RAM</dt><dd className="mt-1 font-medium">{limit(server.limits.memory)}</dd></div><div className="rounded bg-secondary/60 p-2"><dt className="text-muted-foreground">Disque</dt><dd className="mt-1 font-medium">{limit(server.limits.disk)}</dd></div><div className="rounded bg-secondary/60 p-2"><dt className="text-muted-foreground">CPU</dt><dd className="mt-1 font-medium">{limit(server.limits.cpu, "%")}</dd></div><div className="rounded bg-secondary/60 p-2"><dt className="text-muted-foreground">Bases de données</dt><dd className="mt-1 font-medium">{limit(server.limits.databases, "")}</dd></div></dl>
      </article>)}</div>}
    </SectionCard>}
  </div>;
}
