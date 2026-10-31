import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Fingerprint, KeyRound, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { commands, type SshKeySummary } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, SectionCard, selectStyles, textareaStyles } from "@/components/page-shell";

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
    mutationFn: () => commands.generateSshKey({ name, key_type: keyType, bits: keyType === "rsa" ? 4096 : null, passphrase: passphrase || null, comment }),
    onSuccess: () => {
      toast.success("Clé SSH générée");
      setName(""); setPassphrase(""); setComment("");
      void qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
    onError: (e) => toast.error(String(e)),
  });
  const imp = useMutation({
    mutationFn: () => commands.importPublicKey(importName, importKey),
    onSuccess: () => {
      toast.success("Clé publique importée");
      setImportName(""); setImportKey("");
      void qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
    onError: (e) => toast.error(String(e)),
  });
  const del = useMutation({
    mutationFn: (trashId: string) => commands.deleteSshKey(trashId),
    onSuccess: () => { toast.success("Clé placée dans la corbeille"); void qc.invalidateQueries({ queryKey: ["ssh-keys"] }); },
    onError: (e) => toast.error(String(e)),
  });
  const count = keys.data?.length ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Identités & accès" title="Clés SSH" description="Créez, importez et gérez vos identités SSH locales. Les clés privées restent sur cet ordinateur." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Générer une clé" description="Une nouvelle paire de clés sera créée dans votre dossier SSH.">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); gen.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de la clé" htmlFor="ssh-name"><Input id="ssh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. serveur-production" required /></Field>
              <Field label="Algorithme" htmlFor="ssh-type">
                <select id="ssh-type" className={selectStyles} value={keyType} onChange={(e) => setKeyType(e.target.value)}>
                  <option value="ed25519">Ed25519 (recommandé)</option>
                  <option value="rsa">RSA 4096</option>
                  <option value="ecdsa">ECDSA</option>
                </select>
              </Field>
              <Field label="Phrase de passe" htmlFor="ssh-pass" hint="Facultative, recommandée pour les clés privées."><Input id="ssh-pass" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password" placeholder="Protéger la clé" /></Field>
              <Field label="Commentaire" htmlFor="ssh-comment"><Input id="ssh-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Étiquette facultative" /></Field>
            </div>
            <Button type="submit" disabled={gen.isPending || !name.trim()}><Plus className="mr-2 size-4" />{gen.isPending ? "Génération…" : "Générer une clé"}</Button>
          </form>
        </SectionCard>
        <SectionCard title="Importer une clé publique" description="Collez uniquement une clé publique OpenSSH, jamais une clé privée.">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); imp.mutate(); }}>
            <Field label="Nom de la clé" htmlFor="import-name"><Input id="import-name" value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="ex. github" required /></Field>
            <Field label="Contenu de la clé publique" htmlFor="import-content"><textarea id="import-content" className={textareaStyles + " font-mono text-xs"} value={importKey} onChange={(e) => setImportKey(e.target.value)} placeholder="ssh-ed25519 AAAA…" required spellCheck={false} /></Field>
            <Button type="submit" variant="outline" disabled={imp.isPending || !importName.trim() || !importKey.trim()}><Upload className="mr-2 size-4" />Importer la clé</Button>
          </form>
        </SectionCard>
      </div>
      <SectionCard title="Clés détectées" description="Clés trouvées dans le répertoire SSH de votre compte Windows."
        action={<span className="rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{count} clé{count > 1 ? "s" : ""}</span>}>
        {keys.isPending ? <p className="text-sm text-muted-foreground">Chargement des clés…</p>
          : keys.isError ? <p role="alert" className="text-sm text-destructive">Impossible de lire les clés SSH : {String(keys.error)}</p>
          : count === 0 ? <EmptyState message="Aucune clé trouvée. Générez ou importez votre première clé SSH." />
          : <div className="divide-y divide-border/70">
              {(keys.data ?? []).map((key: SshKeySummary) => (
                <article key={key.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/70"><KeyRound className="size-5 text-primary" /></div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-sm font-medium">{key.name}</h3>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Fingerprint className="size-3.5" /> {key.key_type ?? "inconnu"} · <span className="break-all font-mono">{key.fingerprint ?? "Empreinte indisponible"}</span></p>
                      {key.comment && <p className="text-xs text-muted-foreground">{key.comment}</p>}
                      {key.permissions_warning && <p className="text-xs text-destructive">Vérifiez les permissions de cette clé.</p>}
                      {key.encrypted && <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Protégée par phrase de passe</p>}
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={del.isPending}
                    onClick={() => { if (window.confirm(`Placer la clé « ${key.name} » dans la corbeille SSH ?`)) del.mutate(key.id); }}>
                    <Trash2 className="mr-2 size-3.5" />Supprimer
                  </Button>
                </article>
              ))}
            </div>}
      </SectionCard>
    </div>
  );
}
