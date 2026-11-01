import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ExternalLink, LockKeyhole, Plus, ServerCog, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, SectionCard, selectStyles } from "@/components/page-shell";
import { commands, type PanelConfig } from "@/lib/tauri";

export default function PanelsPage() {
  const qc = useQueryClient();
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const [name, setName] = useState("HébergTonServ");
  const [provider, setProvider] = useState("wisp");
  const [baseUrl, setBaseUrl] = useState("https://manage.hebergtonserv.com/");
  const [allowLocal, setAllowLocal] = useState(false);
  const [token, setToken] = useState("");
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !token.trim() || !baseUrl.trim()) throw new Error("Nom, adresse HTTPS et jeton API requis.");
      const id = crypto.randomUUID();
      await commands.savePanel({ id, name: name.trim(), provider, base_url: baseUrl.trim(), pterodactyl_version: "auto",
        allow_local: allowLocal, status: null, account_label: null, last_checked_at: null });
      try { await commands.setPanelToken(id, token); }
      catch (error) {
        try { await commands.deletePanel(id); }
        catch { toast.error("Le panel a été enregistré sans jeton : supprimez-le manuellement."); }
        throw error;
      }
    },
    onSuccess: () => { setToken(""); toast.success("Panel et jeton sauvegardés dans le coffre Windows"); void qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e) => toast.error(String(e)),
  });
  const saveExistingToken = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => commands.setPanelToken(id, value),
    onSuccess: (_data, { id }) => { setTokenDrafts((state) => ({ ...state, [id]: "" })); toast.success("Jeton remplacé dans Windows Credential Manager"); },
    onError: (e) => toast.error(String(e)),
  });
  const check = useMutation({
    mutationFn: (id: string) => commands.checkPanel(id),
    onSuccess: (result) => { toast.success(result.message); void qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e) => toast.error(String(e)),
  });
  const del = useMutation({
    mutationFn: commands.deletePanel,
    onSuccess: () => { toast.success("Panel supprimé"); void qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Infrastructure" title="Panels d'hébergement" description="Connectez vos espaces Wisp et Pterodactyl sans enregistrer les jetons en clair. Les informations sensibles restent protégées par Windows." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SectionCard title="Ajouter un panel" description="Renseignez l'adresse de l'API Client et sa clé d'accès.">
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><span>La clé est conservée dans Windows Credential Manager. Seule l’API Client HTTPS est appelée; aucun cookie de navigateur n’est lu.</span></div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field htmlFor="panel-name" label="Nom du panel"><Input id="panel-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field htmlFor="panel-provider" label="Plateforme"><select id="panel-provider" className={selectStyles} value={provider} onChange={(e) => setProvider(e.target.value)}><option value="wisp">Wisp</option><option value="pterodactyl">Pterodactyl</option></select></Field>
            <Field htmlFor="panel-url" label="Adresse du panel"><Input id="panel-url" type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://panel.exemple.fr/" required /></Field>
            <Field htmlFor="panel-token" label="Jeton API" hint="Saisi uniquement ici ; jamais affiché ou stocké dans un fichier JSON.">
              <Input id="panel-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Clé d'API Client" autoComplete="off" required />
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-border/70 p-3 text-xs text-muted-foreground">
              <input className="mt-0.5 size-4 accent-primary" type="checkbox" checked={allowLocal} onChange={(e) => setAllowLocal(e.target.checked)} />
              <span>Autoriser une cible locale (boucle locale uniquement). À activer seulement pour les panels de développement.</span>
            </label>
            <Button type="submit" disabled={save.isPending || !name.trim() || !token.trim() || !baseUrl.trim()}>
              <Plus className="mr-2 size-4" />{save.isPending ? "Enregistrement…" : "Enregistrer le panel"}
            </Button>
          </form>
        </SectionCard>
        <SectionCard title="Panels enregistrés" description={`${panels.data?.length ?? 0} connexion(s) configurée(s).`}>
          {panels.isPending ? <p className="text-sm text-muted-foreground">Chargement des panels…</p>
            : panels.isError ? <p role="alert" className="text-sm text-destructive">{String(panels.error)}</p>
            : !panels.data?.length ? <EmptyState message="Aucun panel configuré. Ajoutez votre espace Wisp ou Pterodactyl." />
            : <div className="divide-y divide-border/70">
                {(panels.data ?? []).map((p: PanelConfig) => (
                  <article key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><ServerCog className="size-5 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{p.name}<span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-normal uppercase text-muted-foreground">{p.provider}</span></h3>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{p.base_url}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {p.status === "ok" ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <ExternalLink className="size-3.5" />}
                          {p.status === "ok" ? (p.account_label ?? "Compte vérifié") : "Connexion non vérifiée"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative min-w-0 flex-1">
                        <LockKeyhole className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input className="pl-9" type="password" autoComplete="off" aria-label={`Nouveau jeton pour ${p.name}`} placeholder="Remplacer le jeton API"
                          value={tokenDrafts[p.id] ?? ""} onChange={(e) => setTokenDrafts((v) => ({ ...v, [p.id]: e.target.value }))} />
                      </div>
                      <Button variant="secondary" size="sm" disabled={saveExistingToken.isPending || !(tokenDrafts[p.id] ?? "").trim()} onClick={() => saveExistingToken.mutate({ id: p.id, value: tokenDrafts[p.id] })}>Sauvegarder le jeton</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={check.isPending} onClick={() => check.mutate(p.id)}><CheckCircle2 className="mr-1.5 size-3.5" />Vérifier</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={del.isPending} onClick={() => { if (window.confirm(`Supprimer « ${p.name} » et son jeton enregistré ?`)) del.mutate(p.id); }}><Trash2 className="mr-1.5 size-3.5" />Supprimer</Button>
                    </div>
                  </article>
                ))}
              </div>}
        </SectionCard>
      </div>
    </div>
  );
}
