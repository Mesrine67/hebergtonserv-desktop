import { useQuery } from "@tanstack/react-query";
import { commands } from "../lib/tauri";

export default function SecurityPage() {
  const security = useQuery({ queryKey: ["security"], queryFn: commands.getSecurityState });
  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-semibold">Sécurité</h2>
      <div className="border border-slate-700 rounded p-4 space-y-2">
        <div>Keyring disponible : {security.data?.keyring_available ? "oui" : "non"}</div>
        <div>HTTPS uniquement : {security.data?.https_only ? "oui" : "non"}</div>
      </div>
      <p className="text-sm text-slate-400">
        Les jetons d'API ne sont jamais stockés en clair dans les fichiers ou le localStorage.
        Ils sont conservés dans le Windows Credential Manager via le backend Rust.
      </p>
    </div>
  );
}
