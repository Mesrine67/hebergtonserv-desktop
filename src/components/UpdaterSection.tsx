import { useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";

export default function UpdaterSection() {
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  async function checkForUpdates() {
    if (!isTauri()) {
      toast.info("La recherche de mises à jour est disponible dans l'application installée.");
      return;
    }
    setBusy(true);
    try {
      const version = await getVersion();
      setCurrentVersion(version);
      const candidate = await check();
      if (available) await available.close();
      setAvailable(candidate);
      if (candidate) {
        toast.info(`Version ${candidate.version} disponible.`);
      } else {
        toast.success("Vous utilisez la dernière version disponible.");
      }
    } catch {
      toast.error("Recherche impossible : vérifiez votre connexion ou la publication GitHub.");
    } finally {
      setBusy(false);
    }
  }

  async function installUpdate() {
    if (!available || !isTauri()) return;
    setBusy(true);
    setDownloadedBytes(0);
    try {
      // Windows hands control to its signed installer and closes this process.
      // Installation requires an explicit click; never install automatically.
      await available.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          setDownloadedBytes((previous) => previous + event.data.chunkLength);
        }
      });
      toast.info("Installation de la mise à jour démarrée.");
    } catch {
      toast.error("La mise à jour n'a pas pu être téléchargée ou installée.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border border-slate-800 rounded-lg p-4" aria-label="Mises à jour">
      <h3 className="text-lg font-medium">Mises à jour</h3>
      <p className="text-sm text-slate-400">
        Recherche manuelle des nouvelles versions officielles, téléchargées et
        vérifiées grâce à leur signature.
        {currentVersion ? ` Version actuelle : ${currentVersion}.` : ""}
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-2 rounded"
          onClick={() => void checkForUpdates()}
          disabled={busy}
        >
          {busy ? "Opération en cours…" : "Rechercher des mises à jour"}
        </button>
        {available && (
          <button
            type="button"
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded"
            onClick={() => void installUpdate()}
            disabled={busy}
          >
            Installer la version {available.version}
          </button>
        )}
      </div>
      {downloadedBytes > 0 && (
        <p className="text-xs text-slate-400" role="status" aria-live="polite">
          Téléchargé : {(downloadedBytes / (1024 * 1024)).toFixed(1)} Mo
        </p>
      )}
    </section>
  );
}
