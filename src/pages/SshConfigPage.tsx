import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands, type HostKeyEntry } from "../lib/tauri";
import { toast } from "sonner";

export default function SshConfigPage() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["ssh-config"], queryFn: commands.readSshConfig });
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [user, setUser] = useState("");
  const [identity, setIdentity] = useState("");
  const [scanned, setScanned] = useState<HostKeyEntry | null>(null);
  const [fingerprintConfirmation, setFingerprintConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const resetScan = () => { setScanned(null); setFingerprintConfirmation(""); };

  const save = async () => {
    try {
      await commands.upsertSshConfig({ host, port, user: user || null, identity_file: identity || null });
      await queryClient.invalidateQueries({ queryKey: ["ssh-config"] });
      toast.success("Entrée SSH enregistrée");
    } catch (error) { toast.error(String(error)); }
  };

  const scan = async () => {
    resetScan();
    if (!host.trim() || port < 1 || port > 65535) {
      toast.error("Hôte ou port invalide");
      return;
    }
    setBusy(true);
    try { setScanned(await commands.scanHostKey(host.trim(), port)); }
    catch (error) { toast.error(String(error)); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!scanned || fingerprintConfirmation.trim() !== scanned.fingerprint ||
        scanned.port !== port || ![host.trim(), "[" + host.trim() + "]:" + port].includes(scanned.host)) {
      toast.error("Empreinte ou hôte non confirmé.");
      return;
    }
    setBusy(true);
    try {
      await commands.appendHostKey(host.trim(), port, scanned);
      toast.success("Clé de l'hôte approuvée dans known_hosts");
      resetScan();
    } catch (error) { toast.error(String(error)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Configuration SSH (~/.ssh/config)</h2>
      <p className="text-sm text-slate-400">Chemin : {config.data?.path}</p>
      <section className="space-y-2 max-w-2xl">
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="Host" value={host} onChange={(e) => { setHost(e.target.value); resetScan(); }} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" type="number" min={1} max={65535} placeholder="Port" value={port} onChange={(e) => { setPort(Number(e.target.value)); resetScan(); }} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="User" value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="bg-slate-800 px-3 py-2 rounded w-full" placeholder="IdentityFile" value={identity} onChange={(e) => setIdentity(e.target.value)} />
        <button className="bg-blue-600 px-4 py-2 rounded" onClick={() => void save()}>Enregistrer</button>
      </section>
      <section className="space-y-3 max-w-2xl border border-slate-700 rounded p-4">
        <h3 className="font-semibold">Vérification de la clé d'hôte</h3>
        <p className="text-sm text-slate-400">
          Le résultat de ssh-keyscan n'authentifie pas le serveur. Vérifiez l'empreinte
          auprès de votre administrateur par un canal indépendant avant de l'approuver.
        </p>
        <button className="bg-slate-700 px-4 py-2 rounded disabled:opacity-50" disabled={busy} onClick={() => void scan()}>
          Scanner la clé de l'hôte
        </button>
        {scanned && (
          <div className="space-y-2 text-sm">
            <p>Hôte : {scanned.host} — Port : {scanned.port} — Type : {scanned.key_type}</p>
            <p className="font-mono break-all">Empreinte : {scanned.fingerprint}</p>
            <label htmlFor="fingerprint-confirmation" className="block">Saisissez l'empreinte vérifiée pour confirmer</label>
            <input
              id="fingerprint-confirmation"
              className="bg-slate-800 px-3 py-2 rounded w-full font-mono"
              value={fingerprintConfirmation}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setFingerprintConfirmation(e.target.value)}
            />
            <button className="bg-emerald-700 px-4 py-2 rounded disabled:opacity-50" disabled={busy || fingerprintConfirmation.trim() !== scanned.fingerprint} onClick={() => void approve()}>
              Approuver dans known_hosts
            </button>
          </div>
        )}
      </section>
      <section>
        <h3 className="text-lg font-medium mb-2">Entrées existantes</h3>
        <div className="space-y-2">
          {(config.data?.entries ?? []).map((entry) => (
            <div key={entry.host} className="border border-slate-700 rounded p-3">
              <div className="font-medium">{entry.host}</div>
              <div className="text-sm text-slate-400">
                Port {entry.port ?? 22} • {entry.user ?? "—"} • {entry.identity_file ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
