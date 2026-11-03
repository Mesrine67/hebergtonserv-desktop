import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ExternalLink, LockKeyhole, Plus, ServerCog, Trash2, ShieldCheck, Server, UserRound, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { errorMessage } from "@/lib/error-message";
import { serverListRoute } from "@/lib/panel-navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, SectionCard } from "@/components/page-shell";
import { commands, type PanelConfig } from "@/lib/tauri";

export default function PanelsPage() {
  const qc = useQueryClient();
  const panels = useQuery({ queryKey: ["panels"], queryFn: commands.listPanels });
  const [name, setName] = useState("HébergTonServ");
  const [baseUrl, setBaseUrl] = useState("https://manage.hebergtonserv.com/");
  const [allowLocal, setAllowLocal] = useState(false);
  const [token, setToken] = useState("");
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !token.trim() || !baseUrl.trim()) throw new Error("Nom, adresse HTTPS et jeton Client API requis.");
      const normalizedUrl = new URL(baseUrl.trim()).toString().replace(/\/+$/, "");
      const existing = panels.data?.find((panel) => {
        try { return new URL(panel.base_url).toString().replace(/\/+$/, "") === normalizedUrl; }
        catch { return false; }
      });
      if (existing) {
        await commands.setPanelToken(existing.id, token.trim());
        await commands.checkPanel(existing.id);
        return { id: existing.id, replaced: true };
      }
      const id = crypto.randomUUID();
      await commands.savePanel({ id, name: name.trim(), provider: "wisp", base_url: baseUrl.trim(), pterodactyl_version: "auto",
        allow_local: allowLocal, status: null, account_label: null, last_checked_at: null });
      try { await commands.setPanelToken(id, token); }
      catch (error) {
        try { await commands.deletePanel(id); }
        catch { toast.error("Le panel a été enregistré sans jeton : supprimez-le manuellement."); }
        throw error;
      }
      await commands.checkPanel(id);
      return { id, replaced: false };
    },
    onSuccess: (result) => { setToken(""); toast.success(result.replaced ? "Panel existant mis à jour et détecté" : "Panel détecté et accès sauvegardé dans le coffre Windows"); void qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveExistingToken = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => commands.setPanelToken(id, value),
    onSuccess: (_data, { id }) => { setTokenDrafts((state) => ({ ...state, [id]: "" })); toast.success("Jeton remplacé dans Windows Credential Manager"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const check = useMutation({
    mutationFn: (id: string) => commands.checkPanel(id),
    onSuccess: (result) => { toast.success(result.message); void qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: commands.deletePanel,
    onSuccess: () => { toast.success("Panel supprimé"); void qc.invalidateQueries({ queryKey: ["panels"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Infrastructure · Connexions" title="Panels d'hébergement" description="Connectez-vous à vos panels. Le type WISP ou Pterodactyl est détecté automatiquement." />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Panels configurés</p><p className="mt-1 text-2xl font-semibold tabular-nums">{panels.data?.length ?? 0}</p></div>
        <div className="rounded-xl border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Connexions vérifiées</p><p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-500">{panels.data?.filter(p => p.status === "ok").length ?? 0}</p></div>
        <div className="rounded-xl border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Sécurité des clés</p><p className="mt-1 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-primary" /> Windows Credential Manager</p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SectionCard title="Ajouter un panel" description="Renseignez l’adresse du panel et sa clé Client API.">
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground"><WandSparkles className="mt-0.5 size-4 shrink-0 text-primary" /><span>Cette option est un secours pour une clé existante. Le fournisseur et le format WISP/Pterodactyl sont détectés à la vérification; une adresse déjà enregistrée sera mise à jour, sans créer de doublon.</span></div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field htmlFor="panel-name" label="Nom du panel"><Input id="panel-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field htmlFor="panel-url" label="Adresse du panel"><Input id="panel-url" type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://panel.exemple.fr/" required /></Field>
            <Field htmlFor="panel-token" label="Clé Client API" hint="La connexion initiale WISP/Pterodactyl nécessite cette clé. Le type de panel est ensuite détecté automatiquement.">
              <Input id="panel-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jeton de secours" autoComplete="off" required />
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-border/70 p-3 text-xs text-muted-foreground">
              <input className="mt-0.5 size-4 accent-primary" type="checkbox" checked={allowLocal} onChange={(e) => setAllowLocal(e.target.checked)} />
              <span>Autoriser un panel local de développement (boucle locale uniquement).</span>
            </label>
            <Button type="submit" variant="outline" disabled={save.isPending || !name.trim() || !token.trim() || !baseUrl.trim()}>
              <Plus className="mr-2 size-4" />{save.isPending ? "Enregistrement…" : "Enregistrer une clé existante"}
            </Button>
          </form>
        </SectionCard>
        <SectionCard title="Panels enregistrés" description={`${panels.data?.length ?? 0} connexion(s) configurée(s).`}>
          {panels.isPending ? <p className="text-sm text-muted-foreground">Chargement des panels…</p>
            : panels.isError ? <p role="alert" className="text-sm text-destructive">{String(panels.error)}</p>
            : !panels.data?.length ? <EmptyState message="Aucun panel configuré. Ajoutez votre espace Wisp ou Pterodactyl." />
            : <div className="divide-y divide-border/70">
                {(panels.data ?? []).map((p: PanelConfig) => (
                  <article key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0" aria-label={`Panel ${p.name}`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><ServerCog className="size-5 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{p.name}<span className="rounded-md border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{p.provider}</span><span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${p.status === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-border bg-secondary text-muted-foreground"}`}>{p.status === "ok" ? "Vérifié" : "À vérifier"}</span></h3>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{p.base_url}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Détection automatique · {p.provider === "wisp" ? "WISP" : "Pterodactyl"}</p>
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
                      <Button type="button" size="sm" variant="secondary" asChild><Link to={`/panel/account?panel=${encodeURIComponent(p.id)}`}><UserRound className="mr-1.5 size-3.5" />Compte</Link></Button>
                      <Button type="button" size="sm" variant="secondary" asChild><Link to={serverListRoute(p.id)}><Server className="mr-1.5 size-3.5" />Serveurs</Link></Button>
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
