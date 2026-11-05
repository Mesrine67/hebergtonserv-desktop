import { ArrowDownToLine, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/page-shell";
import { useAppUpdater } from "@/lib/app-updater";

export default function UpdaterSection() {
  const updater = useAppUpdater();
  const busy = updater.status === "checking" || updater.status === "installing";
  return (
    <SectionCard title="Mises à jour de l'application" description="Détection automatique des versions signées sur GitHub Releases.">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
          <RefreshCw className={"size-4 shrink-0 text-primary " + (updater.status === "checking" ? "animate-spin" : "")} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Version installée : v{updater.currentVersion}</p>
            <p className="text-xs text-muted-foreground">Recherche au démarrage, toutes les heures et au retour dans l'application.</p>
            {updater.availableVersion && <p role="status" className="mt-1 text-xs font-medium text-primary">v{updater.availableVersion} disponible</p>}
            {updater.status === "current" && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5"/> Version à jour</p>}
            {updater.status === "error" && <p className="mt-1 text-xs text-destructive">Dernière vérification impossible.</p>}
          </div>
        </div>
        {updater.releaseNotes && updater.availableVersion && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 text-xs">{updater.releaseNotes}</pre>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void updater.checkForUpdates(false)}>
            <RefreshCw className="mr-2 size-4"/> {updater.status === "checking" ? "Vérification…" : "Vérifier maintenant"}
          </Button>
          {updater.availableVersion && <Button disabled={busy} onClick={() => void updater.installUpdate()}><ArrowDownToLine className="mr-2 size-4"/> Installer v{updater.availableVersion}</Button>}
        </div>
        {updater.status === "installing" && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          Téléchargé : {(updater.downloadedBytes / 1048576).toFixed(1)} Mo
          {updater.totalBytes ? " / " + (updater.totalBytes / 1048576).toFixed(1) + " Mo" : ""}
        </p>}
        {updater.checkedAt !== null && <p className="text-xs text-muted-foreground">Dernière vérification : {new Date(updater.checkedAt).toLocaleString("fr-FR")}</p>}
        <p className="text-xs text-muted-foreground">Les mises à jour ne sont jamais installées automatiquement.</p>
      </div>
    </SectionCard>
  );
}
