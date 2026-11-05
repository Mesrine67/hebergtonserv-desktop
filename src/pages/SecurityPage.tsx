import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/page-shell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { commands } from "@/lib/tauri";

export default function SecurityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const security = useQuery({ queryKey: ["security"], queryFn: commands.getSecurityState });
  const rows = [
    { label: "Coffre d'identifiants Windows", explanation: "Stockage sécurisé des jetons API par panel.", ok: security.data?.keyring_available },
    { label: "Connexions HTTPS uniquement", explanation: "Toutes les requêtes API passent par des connexions chiffrées.", ok: security.data?.https_only },
  ];
  return (
    <Dialog open onOpenChange={open => { if (!open) { if (location.key === "default") navigate("/home"); else navigate(-1); } }}>
      <DialogContent className="max-h-[86vh] w-[min(94vw,780px)] max-w-none overflow-y-auto bg-card p-0 sm:max-w-none">
      <DialogHeader className="border-b px-6 py-5 pr-14">
        <DialogTitle>Sécurité</DialogTitle>
        <DialogDescription>Contrôlez l’état des protections appliquées à vos connexions SSH et à vos panels d’hébergement.</DialogDescription>
      </DialogHeader>
      <div className="space-y-6 p-5 md:p-6">
      <SectionCard title="État des protections" description="Ces informations proviennent du backend de l'application." className="max-w-3xl">
        {security.isPending ? <p className="text-sm text-muted-foreground">Vérification des protections…</p>
          : security.isError ? <p role="alert" className="text-sm text-destructive">État de sécurité indisponible : {String(security.error)}</p>
          : <div className="divide-y divide-border">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    {row.ok ? <ShieldCheck className="size-5 text-emerald-500" /> : <ShieldAlert className="size-5 text-destructive" />}
                  </div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{row.label}</p><p className="mt-1 text-xs text-muted-foreground">{row.explanation}</p></div>
                  <span className={row.ok ? "flex items-center gap-1 text-xs text-emerald-500" : "text-xs text-destructive"}>
                    {row.ok && <CheckCircle2 className="size-3.5" />}{row.ok ? "Actif" : "À vérifier"}
                  </span>
                </div>
              ))}
            </div>}
      </SectionCard>
      <div className="flex max-w-3xl items-start gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
        Les jetons API sont gérés par le coffre d'identifiants Windows via Rust. Ils ne sont pas conservés en clair dans les fichiers JSON ou le localStorage.
      </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}
