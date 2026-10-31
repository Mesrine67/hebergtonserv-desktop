import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Import, Plus, Server, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, SectionCard, selectStyles } from "@/components/page-shell";
import { commands, type SshProfile } from "@/lib/tauri";

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
    mutationFn: () => commands.saveProfile({
      id: crypto.randomUUID(), name, host, port, username,
      auth_method: authMethod, key_name: authMethod === "key" ? keyName : null,
      group, created_at: null, updated_at: null, last_connected_at: null,
    }),
    onSuccess: () => { toast.success("Profil enregistré"); setName(""); setHost(""); void qc.invalidateQueries({ queryKey: ["profiles"] }); },
    onError: (e) => toast.error(String(e)),
  });
  const del = useMutation({
    mutationFn: commands.deleteProfile,
    onSuccess: () => { toast.success("Profil supprimé"); void qc.invalidateQueries({ queryKey: ["profiles"] }); },
    onError: (e) => toast.error(String(e)),
  });
  const test = useMutation({
    mutationFn: (p: SshProfile) => commands.testSshConnection({ host: p.host, port: p.port, username: p.username, authMethod: p.auth_method === "key" ? "key" : "password", keyName: p.key_name ?? null }),
    onSuccess: (result) => toast.info(`${result.state} : ${result.message}`),
    onError: (e) => toast.error(String(e)),
  });
  const importProfiles = useMutation({
    mutationFn: commands.importSshConfigProfiles,
    onSuccess: (data) => { toast.success(`${data.length} profil(s) importé(s)`); void qc.invalidateQueries({ queryKey: ["profiles"] }); },
    onError: (e) => toast.error(String(e)),
  });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Accès distant" title="Profils SSH" description="Retrouvez vos connexions distantes, testez leur accessibilité et organisez-les par groupe."
        action={<Button variant="outline" disabled={importProfiles.isPending} onClick={() => importProfiles.mutate()}><Import className="mr-2 size-4" />Importer ~/.ssh/config</Button>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]">
        <SectionCard title="Nouveau profil" description="Enregistrez une destination SSH pour la retrouver rapidement.">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field label="Nom du profil" htmlFor="profile-name"><Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production" required /></Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
              <Field label="Adresse du serveur" htmlFor="profile-host"><Input id="profile-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="ssh.exemple.fr" required /></Field>
              <Field label="Port" htmlFor="profile-port"><Input id="profile-port" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} required /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Utilisateur" htmlFor="profile-user"><Input id="profile-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" required /></Field>
              <Field label="Authentification" htmlFor="profile-auth"><select id="profile-auth" className={selectStyles} value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}><option value="key">Clé SSH</option><option value="password">Mot de passe</option></select></Field>
            </div>
            {authMethod === "key" && <Field label="Nom de la clé" htmlFor="profile-key"><Input id="profile-key" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="id_ed25519" /></Field>}
            <Field label="Groupe" htmlFor="profile-group"><Input id="profile-group" value={group} onChange={(e) => setGroup(e.target.value)} /></Field>
            <Button type="submit" disabled={save.isPending || !name.trim() || !host.trim() || !username.trim() || port < 1 || port > 65535}><Plus className="mr-2 size-4" />Enregistrer le profil</Button>
          </form>
        </SectionCard>
        <SectionCard title="Connexions enregistrées" description={`${profiles.data?.length ?? 0} profil(s) dans votre bibliothèque.`}>
          {profiles.isPending ? <p className="text-sm text-muted-foreground">Chargement des profils…</p>
            : profiles.isError ? <p role="alert" className="text-sm text-destructive">{String(profiles.error)}</p>
            : !profiles.data?.length ? <EmptyState message="Aucun profil. Créez-en un ou importez depuis SSH config." />
            : <div className="divide-y divide-border/70">
                {profiles.data.map((p: SshProfile) => (
                  <article key={p.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary"><Server className="size-4 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium">{p.name}</h3>
                        <p className="break-all font-mono text-xs text-muted-foreground">{p.username}@{p.host}:{p.port}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{p.group} · {p.auth_method === "key" ? "Clé SSH" : "Mot de passe"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pl-12">
                      <Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate(p)}><Wifi className="mr-2 size-3.5" />Tester</Button>
                      <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => { if (window.confirm(`Supprimer le profil « ${p.name} » ?`)) del.mutate(p.id); }}><Trash2 className="mr-2 size-3.5" />Supprimer</Button>
                    </div>
                  </article>
                ))}
              </div>}
        </SectionCard>
      </div>
    </div>
  );
}
