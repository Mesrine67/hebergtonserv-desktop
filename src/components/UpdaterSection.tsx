import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/page-shell";

export default function UpdaterSection() {
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  async function checkForUpdates() {
    if (!isTauri()) { toast.info("Les mises à jour nécessitent l'application Windows installée."); return; }
    setBusy(true);
    try {
      const version = await getVersion();
      setCurrentVersion(version);
      const candidate = await check();
      if (available) await available.close();
      setAvailable(candidate);
      if (candidate) toast.info(`Version ${candidate.version} disponible`);
      else toast.success("Vous utilisez la dernière version.");
    } catch { toast.error("Recherche impossible : vérifiez la connexion ou la publication GitHub."); }
    finally { setBusy(false); }
  }

  async function installUpdate() {
    if (!available || !isTauri()) return;
    setBusy(true);
    setDownloadedBytes(0);
    try {
      await available.downloadAndInstall((event) => {
        if (event.event === "Progress") setDownloadedBytes((previous) => previous + event.data.chunkLength);
      });
      toast.info("Installation de la mise à jour démarrée.");
    } catch { toast.error("Impossible de télécharger ou installer cette mise à jour."); }
    finally { setBusy(false); }
  }

  return (
    <SectionCard title="Mises à jour de l'application" description="Vérifiez les nouvelles versions signées disponibles sur GitHub.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
          <RefreshCw className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Version installée : {currentVersion ?? "Non vérifiée"}</p>
            <p className="text-xs text-muted-foreground">Les mises à jour sont vérifiées et installées uniquement sur confirmation.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void checkForUpdates()}>
            <RefreshCw className="mr-2 size-4" />{busy ? "Vérification…" : "Rechercher des mises à jour"}
          </Button>
          {available && <Button disabled={busy} onClick={() => void installUpdate()}><Download className="mr-2 size-4" />Installer v{available.version}</Button>}
        </div>
        {downloadedBytes > 0 && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Téléchargé : {(downloadedBytes / 1048576).toFixed(1)} Mo</p>}
      </div>
    </SectionCard>
  );
}
