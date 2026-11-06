import { useState } from "react";
import { KeyRound, LoaderCircle, Server, ShieldCheck } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { commands } from "@/lib/tauri";
import { errorMessage } from "@/lib/error-message";

type Props = { onAuthenticated: (account: { display_name: string; email: string }) => void };

export default function WispLoginPage({ onAuthenticated }: Props) {
  const [baseUrl, setBaseUrl] = useState("https://manage.hebergtonserv.com");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isTauri()) {
      setError("La connexion sécurisée nécessite l’application de bureau : elle utilise le coffre Windows pour protéger votre clé API. En mode navigateur, aucune clé n’est enregistrée ni envoyée.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await commands.loginWisp(baseUrl.trim(), token.trim());
      setToken("");
      onAuthenticated({ display_name: result.display_name, email: result.email });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hts-auth-screen min-h-0 flex-1">
      <section className="hts-auth-card">
        <div className="hts-auth-brand"><img src="/hebergtonserv-mark.png" alt="" /><span>HébergTonServ <span className="text-muted-foreground">Desktop</span></span></div>
        <div className="hts-auth-icon"><KeyRound className="size-5" /></div>
        <p className="hts-auth-eyebrow">Connexion sécurisée</p>
        <h1>Connectez votre panel</h1>
        <p className="hts-auth-description">Entrez une clé Client API une seule fois. L’application détecte le fournisseur et son contrat, puis conserve la clé dans le coffre Windows.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm font-medium" htmlFor="panel-url">Adresse du panel
            <span className="relative block"><Server className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="panel-url" type="url" className="h-10 pl-10" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} autoComplete="url" required /></span>
          </label>
          <label className="block space-y-2 text-sm font-medium" htmlFor="panel-token">Clé Client API
            <Input id="panel-token" type="password" className="h-10 font-mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Collez la clé du panel" autoComplete="off" required />
          </label>
          <div className="flex gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><span>{isTauri() ? "La connexion par clé Client API est disponible. La connexion par e-mail et mot de passe reste en cours de validation. La clé est conservée dans le coffre Windows." : "Mode navigateur de développement : la connexion nécessite l’application de bureau et le coffre Windows. Aucune clé ne sera enregistrée dans ce navigateur."}</span></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button className="h-10 w-full" type="submit" disabled={busy || !isTauri() || !baseUrl.trim() || !token.trim()}>{busy ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Détection et vérification…</> : isTauri() ? "Enregistrer et vérifier" : "Disponible dans l’application de bureau"}</Button>
        </form>
        <button type="button" className="hts-auth-help mx-auto border-0 bg-transparent" onClick={() => { const url = `${baseUrl.replace(/\/+$/, "")}/account/api-keys`; if (isTauri()) void openUrl(url); else window.open(url, "_blank", "noopener,noreferrer"); }}>Ouvrir le gestionnaire des clés API</button>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">Détection WISP / Pterodactyl · stockage protégé par Windows Credential Manager</p>
      </section>
    </main>
  );
}
