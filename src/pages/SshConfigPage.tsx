import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { commands } from "../lib/tauri";
import { toast } from "sonner";

export default function SshConfigPage() {
  const config = useQuery({ queryKey: ["ssh-config"], queryFn: commands.readSshConfig });
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [user, setUser] = useState("");
  const [identity, setIdentity] = useState("");

  const save = async () => {
    try {
      await commands.upsertSshConfig({
        host,
        port,
        user: user || null,
        identity_file: identity || null,
      });
      toast.success("Entrée SSH config enregistrée");
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Configuration SSH (~/.ssh/config)</h2>
      <p className="text-sm text-slate-400">Chemin : {config.data?.path}</p>
      <section className="space-y-2 max-w-2xl">
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" type="number" placeholder="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="User" value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="IdentityFile" value={identity} onChange={(e) => setIdentity(e.target.value)} />
        <button className="bg-blue-600 px-4 py-2 rounded" onClick={save}>Enregistrer</button>
      </section>
      <section>
        <h3 className="text-lg font-medium mb-2">Entrées existantes</h3>
        <div className="space-y-2">
          {(config.data?.entries ?? []).map((e) => (
            <div key={e.host} className="border border-slate-700 rounded p-3">
              <div className="font-medium">{e.host}</div>
              <div className="text-sm text-slate-400">
                Port {e.port ?? 22} • {e.user ?? "—"} • {e.identity_file ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
