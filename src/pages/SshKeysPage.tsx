import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { commands, type SshKeySummary } from "../lib/tauri";
import { toast } from "sonner";

export default function SshKeysPage() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ["ssh-keys"], queryFn: commands.listSshKeys });
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState("ed25519");
  const [passphrase, setPassphrase] = useState("");
  const [comment, setComment] = useState("");
  const [importName, setImportName] = useState("");
  const [importKey, setImportKey] = useState("");

  const gen = useMutation({
    mutationFn: () =>
      commands.generateSshKey({
        name,
        key_type: keyType,
        bits: keyType === "rsa" ? 4096 : null,
        passphrase: passphrase || null,
        comment,
      }),
    onSuccess: () => {
      toast.success("Clé générée");
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const imp = useMutation({
    mutationFn: () => commands.importPublicKey(importName, importKey),
    onSuccess: () => {
      toast.success("Clé importée");
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const del = useMutation({
    mutationFn: (trashId: string) => commands.deleteSshKey(trashId),
    onSuccess: () => {
      toast.success("Clé supprimée");
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Clés SSH locales</h2>
      <section className="space-y-2">
        <h3 className="text-lg font-medium">Générer une clé</h3>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          <input className="bg-slate-800 px-3 py-2 rounded" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="bg-slate-800 px-3 py-2 rounded" value={keyType} onChange={(e) => setKeyType(e.target.value)}>
            <option value="ed25519">Ed25519</option>
            <option value="rsa">RSA 4096</option>
            <option value="ecdsa">ECDSA</option>
          </select>
          <input className="bg-slate-800 px-3 py-2 rounded" placeholder="Phrase de passe (optionnelle)" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          <input className="bg-slate-800 px-3 py-2 rounded" placeholder="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <button className="bg-blue-600 px-4 py-2 rounded mt-2" onClick={() => gen.mutate()}>Générer</button>
      </section>
      <section className="space-y-2">
        <h3 className="text-lg font-medium">Importer une clé publique</h3>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          <input className="bg-slate-800 px-3 py-2 rounded" placeholder="Nom" value={importName} onChange={(e) => setImportName(e.target.value)} />
          <textarea className="bg-slate-800 px-3 py-2 rounded col-span-2" placeholder="ssh-ed25519 AAAA..." value={importKey} onChange={(e) => setImportKey(e.target.value)} />
        </div>
        <button className="bg-blue-600 px-4 py-2 rounded mt-2" onClick={() => imp.mutate()}>Importer</button>
      </section>
      <section>
        <h3 className="text-lg font-medium mb-2">Clés détectées</h3>
        {keys.isLoading && <p>Chargement…</p>}
        <div className="space-y-2">
          {(keys.data ?? []).map((k: SshKeySummary) => (
            <div key={k.id} className="border border-slate-700 rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{k.name}</div>
                <div className="text-sm text-slate-400">{k.key_type ?? "?"} • {k.fingerprint ?? "—"}</div>
                <div className="text-xs text-slate-500">{k.comment ?? ""}</div>
              </div>
              <button className="text-red-400 hover:text-red-300" onClick={() => del.mutate(k.id)}>Supprimer</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
