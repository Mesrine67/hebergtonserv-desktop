import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Fingerprint, Plus, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, SectionCard } from "@/components/page-shell";
import { commands, type HostKeyEntry } from "@/lib/tauri";

export default function SshConfigPage() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ["ssh-config"], queryFn: commands.readSshConfig });
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [user, setUser] = useState("");
  const [identity, setIdentity] = useState("");
  const [scanned, setScanned] = useState<HostKeyEntry | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const resetScan = () => { setScanned(null); setConfirmation(""); };

  const save = async () => {
    setBusy(true);
    try {
      await commands.upsertSshConfig({ host: host.trim(), port, user: user || null, identity_file: identity || null });
      await qc.invalidateQueries({ queryKey: ["ssh-config"] });
      toast.success("Hôte SSH enregistré");
    } catch (error) { toast.error(String(error)); }
    finally { setBusy(false); }
  };
  const scan = async () => {
    resetScan();
    if (!host.trim() || port < 1 || port > 65535) { toast.error("Hôte ou port invalide"); return; }
    setBusy(true);
    try { setScanned(await commands.scanHostKey(host.trim(), port)); }
    catch (error) { toast.error(String(error)); }
    finally { setBusy(false); }
  };
  const approve = async () => {
    if (!scanned || scanned.port !== port || ![host.trim(), `[${host.trim()}]:${port}`].includes(scanned.host) || confirmation.trim() !== scanned.fingerprint) {
      toast.error("L'hôte et l'empreinte doivent correspondre exactement."); return;
    }
    setBusy(true);
    try { await commands.appendHostKey(host.trim(), port, scanned); toast.success("Clé approuvée et enregistrée"); resetScan(); }
    catch (error) { toast.error(String(error)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Accès distant" title="Configuration SSH" description="Gérez vos hôtes OpenSSH et vérifiez leur identité avant d'ajouter une empreinte de confiance." />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Ajouter un hôte" description={config.data?.path ? `Fichier : ${config.data.path}` : "Configuration ~/.ssh/config"}>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="host" label="Hôte"><Input id="host" value={host} onChange={(e) => { setHost(e.target.value); resetScan(); }} required placeholder="serveur.exemple.fr" /></Field>
              <Field htmlFor="port" label="Port SSH"><Input id="port" type="number" min={1} max={65535} value={port} onChange={(e) => { setPort(Number(e.target.value)); resetScan(); }} required /></Field>
              <Field htmlFor="user" label="Utilisateur"><Input id="user" placeholder="root" value={user} onChange={(e) => setUser(e.target.value)} /></Field>
              <Field htmlFor="identity" label="Fichier de clé"><Input id="identity" placeholder="~/.ssh/id_ed25519" value={identity} onChange={(e) => setIdentity(e.target.value)} /></Field>
            </div>
            <Button type="submit" disabled={busy || !host.trim() || port < 1 || port > 65535}><Plus className="mr-2 size-4" />Enregistrer l'hôte</Button>
          </form>
        </SectionCard>
        <SectionCard title="Vérifier l'identité du serveur" description="Ne faites jamais confiance automatiquement à une clé reçue du réseau.">
          <div className="space-y-4">
            <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              Comparez l'empreinte SHA256 avec une source indépendante (administrateur ou console de votre hébergeur) avant de l'approuver.
            </p>
            <Button type="button" variant="outline" disabled={busy || !host.trim()} onClick={() => void scan()}><Fingerprint className="mr-2 size-4" />Scanner la clé d'hôte</Button>
            {scanned && (
              <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
                <p className="text-sm font-medium">{scanned.host} · port {scanned.port} · {scanned.key_type}</p>
                <p className="break-all rounded-md bg-background px-3 py-2 font-mono text-xs">{scanned.fingerprint}</p>
                <Field htmlFor="fingerprint-confirm" label="Retapez l'empreinte vérifiée">
                  <Input id="fingerprint-confirm" spellCheck={false} autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="SHA256:…" />
                </Field>
                <Button type="button" disabled={busy || confirmation.trim() !== scanned.fingerprint} onClick={() => void approve()}><ShieldCheck className="mr-2 size-4" />Approuver dans known_hosts</Button>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Hôtes configurés" description="Destinations connues de votre configuration SSH.">
        {config.isPending ? <p className="text-sm text-muted-foreground">Chargement de la configuration…</p>
          : config.isError ? <p role="alert" className="text-sm text-destructive">{String(config.error)}</p>
          : !config.data?.entries?.length ? <EmptyState message="Aucun hôte SSH configuré." />
          : <div className="grid gap-3 md:grid-cols-2">
              {config.data.entries.map((entry) => (
                <div key={entry.host} className="flex min-w-0 items-start gap-3 rounded-lg border border-border p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary"><Server className="size-4 text-primary" /></div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{entry.host}</p>
                    <p className="text-xs text-muted-foreground">Port {entry.port ?? 22} · {entry.user ?? "Utilisateur par défaut"}</p>
                    {entry.identity_file && <p className="truncate font-mono text-xs text-muted-foreground" title={entry.identity_file}>{entry.identity_file}</p>}
                  </div>
                </div>
              ))}
            </div>}
      </SectionCard>
    </div>
  );
}
