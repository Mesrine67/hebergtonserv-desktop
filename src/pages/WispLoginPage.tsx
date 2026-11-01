import { useState } from "react";
import { KeyRound, LoaderCircle, Server, ShieldCheck } from "lucide-react";
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
    <main className="hts-auth-screen">
      <section className="hts-auth-card">
        <div className="hts-auth-brand"><img src="/hebergtonserv-mark.png" alt="" /><span>HébergTonServ <span className="text-muted-foreground">Desktop</span></span></div>
        <div className="hts-auth-icon"><KeyRound className="size-5" /></div>
        <p className="hts-auth-eyebrow">Connexion sécurisée</p>
        <h1>Accédez à votre panel</h1>
        <p className="hts-auth-description">Connectez votre compte WISP avec un jeton API Client. La connexion est vérifiée avant d’ouvrir votre espace.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block space-y-2 text-sm font-medium" htmlFor="wisp-url">Adresse du panel
            <span className="relative block"><Server className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="wisp-url" type="url" className="h-10 pl-10" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} autoComplete="url" required /></span>
          </label>
          <label className="block space-y-2 text-sm font-medium" htmlFor="wisp-token">Jeton API Client
            <Input id="wisp-token" type="password" className="h-10 font-mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Collez votre APITOKEN" autoComplete="off" required />
          </label>
          <div className="flex gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><span>Créez un jeton dans votre profil WISP → Security Controls. Il est conservé dans le coffre d’identifiants Windows et envoyé uniquement via HTTPS.</span></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button className="h-10 w-full" type="submit" disabled={busy || !baseUrl.trim() || !token.trim()}>{busy ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Vérification…</> : "Se connecter"}</Button>
        </form>
        <a className="hts-auth-help" href="https://manage.hebergtonserv.com/account/security" target="_blank" rel="noreferrer">Où trouver mon jeton API ?</a>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">WISP Client API · Authentification Bearer · Aucun mot de passe demandé</p>
      </section>
    </main>
  );
}
