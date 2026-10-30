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

  const save = useMutation({
    mutationFn: () =>
      commands.savePanel({
        id: crypto.randomUUID(),
        name,
        provider,
        base_url: baseUrl,
        pterodactyl_version: "auto",
        allow_local: allowLocal,
        status: null,
        account_label: null,
        last_checked_at: null,
      }),
    onSuccess: () => {
      toast.success("Panneau enregistré");
      qc.invalidateQueries({ queryKey: ["panels"] });
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowLocal} onChange={(e) => setAllowLocal(e.target.checked)} />
          Autoriser les hôtes locaux
        </label>
        <button className="bg-blue-600 px-4 py-2 rounded" onClick={() => save.mutate()}>Enregistrer</button>
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
              <div className="flex gap-2">
                <button className="bg-emerald-600 px-3 py-1 rounded text-sm" onClick={() => check.mutate(p.id)}>Vérifier</button>
                <button className="text-red-400 hover:text-red-300" onClick={() => del.mutate(p.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
