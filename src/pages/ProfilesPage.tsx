import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands, type SshProfile } from "../lib/tauri";
import { toast } from "sonner";

export default function ProfilesPage() {
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: commands.listProfiles });
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState("key");
  const [keyName, setKeyName] = useState("");
  const [group, setGroup] = useState("Default");

  const save = useMutation({
    mutationFn: () =>
      commands.saveProfile({
        id: crypto.randomUUID(),
        name,
        host,
        port,
        username,
        auth_method: authMethod,
        key_name: authMethod === "key" ? keyName : null,
        group,
        created_at: null,
        updated_at: null,
        last_connected_at: null,
      }),
    onSuccess: () => {
      toast.success("Profil enregistré");
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => commands.deleteProfile(id),
    onSuccess: () => {
      toast.success("Profil supprimé");
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const test = useMutation({
    mutationFn: (p: SshProfile) =>
      commands.testSshConnection({
        host: p.host,
        port: p.port,
        username: p.username,
        authMethod: p.auth_method === "key" ? "key" : "password",
        keyName: p.key_name ?? null,
      }),
    onSuccess: (r) => toast.info(`${r.state}: ${r.message}`),
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Profils de connexion SSH</h2>
      <section className="space-y-2 max-w-2xl">
        <h3 className="text-lg font-medium">Ajouter un profil</h3>
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Hôte" value={host} onChange={(e) => setHost(e.target.value)} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" type="number" placeholder="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} />
        <select className="bg-slate-800 px-3 py-2 rounded w-full" value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}>
          <option value="key">Clé SSH</option>
          <option value="password">Mot de passe</option>
        </select>
        {authMethod === "key" && (
          <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Nom de la clé" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
        )}
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Groupe" value={group} onChange={(e) => setGroup(e.target.value)} />
        <button className="bg-blue-600 px-4 py-2 rounded" onClick={() => save.mutate()}>Enregistrer</button>
      </section>
      <section>
        <h3 className="text-lg font-medium mb-2">Profils enregistrés</h3>
        <div className="space-y-2">
          {(profiles.data ?? []).map((p: SshProfile) => (
            <div key={p.id} className="border border-slate-700 rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-slate-400">{p.username}@{p.host}:{p.port} ({p.auth_method})</div>
              </div>
              <div className="flex gap-2">
                <button className="bg-emerald-600 px-3 py-1 rounded text-sm" onClick={() => test.mutate(p)}>Tester</button>
                <button className="text-red-400 hover:text-red-300" onClick={() => del.mutate(p.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
