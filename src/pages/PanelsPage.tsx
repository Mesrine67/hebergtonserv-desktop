import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands, type PanelConfig } from "../lib/tauri";
import { toast } from "sonner";

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
      if (!token.trim()) throw new Error("Saisissez le jeton API du panneau.");
      const id = crypto.randomUUID();
      await commands.savePanel({
        id,
        name,
        provider,
        base_url: baseUrl,
        pterodactyl_version: "auto",
        allow_local: allowLocal,
        status: null,
        account_label: null,
        last_checked_at: null,
      });
      await commands.setPanelToken(id, token);
    },
    onSuccess: () => {
      setToken("");
      toast.success("Panneau enregistré");
      qc.invalidateQueries({ queryKey: ["panels"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const saveExistingToken = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => commands.setPanelToken(id, value),
    onSuccess: (_data, variables) => {
      setTokenDrafts((current) => ({ ...current, [variables.id]: "" }));
      toast.success("Jeton stocké dans le coffre Windows.");
    },
    onError: (e) => toast.error(String(e)),
  });

  const check = useMutation({
    mutationFn: (id: string) => commands.checkPanel(id),
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => commands.deletePanel(id),
    onSuccess: () => {
      toast.success("Panneau supprimé");
      qc.invalidateQueries({ queryKey: ["panels"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Panels d'hébergement</h2>
      <section className="space-y-2 max-w-2xl">
        <h3 className="text-lg font-medium">Ajouter un panel</h3>
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="bg-slate-800 px-3 py-2 rounded w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="wisp">Wisp</option>
          <option value="pterodactyl">Pterodactyl</option>
        </select>
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="URL de base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" type="password" autoComplete="off" placeholder="Jeton API (coffre Windows)" value={token} onChange={(e) => setToken(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowLocal} onChange={(e) => setAllowLocal(e.target.checked)} />
          Autoriser les hôtes locaux
        </label>
        <button className="bg-blue-600 px-4 py-2 rounded" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</button>
      </section>
      <section>
        <h3 className="text-lg font-medium mb-2">Panels enregistrés</h3>
        <div className="space-y-2">
          {(panels.data ?? []).map((p: PanelConfig) => (
            <div key={p.id} className="border border-slate-700 rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name} ({p.provider})</div>
                <div className="text-sm text-slate-400">{p.base_url}</div>
                <div className="text-xs text-slate-500">Statut : {p.status ?? "non vérifié"} {p.account_label ? `• ${p.account_label}` : ""}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="bg-slate-800 rounded px-2 py-1 text-sm"
                  type="password"
                  autoComplete="off"
                  aria-label={`Jeton API pour ${p.name}`}
                  placeholder="Ajouter / changer le jeton"
                  value={tokenDrafts[p.id] ?? ""}
                  onChange={(event) => setTokenDrafts((current) => ({ ...current, [p.id]: event.target.value }))}
                />
                <button className="bg-blue-600 px-3 py-1 rounded text-sm" disabled={saveExistingToken.isPending || !(tokenDrafts[p.id] ?? "").trim()} onClick={() => saveExistingToken.mutate({ id: p.id, value: tokenDrafts[p.id] })}>Sauvegarder le jeton</button>
                <button className="bg-emerald-600 px-3 py-1 rounded text-sm" disabled={check.isPending} onClick={() => check.mutate(p.id)}>Vérifier</button>
                <button className="text-red-400 hover:text-red-300" onClick={() => del.mutate(p.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
