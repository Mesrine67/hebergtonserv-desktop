import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { notifyDesktop } from "@/lib/notifications";
import { version as buildVersion } from "../../package.json";

export const UPDATE_STARTUP_DELAY_MS = 12_000;
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000;
export const UPDATE_FOCUS_MIN_AGE_MS = 15 * 60_000;

type Status = "idle" | "preview" | "checking" | "current" | "available" | "installing" | "error";

export function isPreviewVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+-/.test(version);
}

type UpdaterContextValue = {
  currentVersion: string;
  status: Status;
  availableVersion: string | null;
  releaseNotes: string | null;
  checkedAt: number | null;
  downloadedBytes: number;
  totalBytes: number | null;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
};

const UpdaterContext = createContext<UpdaterContextValue | null>(null);

export function AppUpdaterProvider({ children, appVersion = buildVersion }: { children: ReactNode; appVersion?: string }) {
  const preview = isPreviewVersion(appVersion);
  const [currentVersion, setCurrentVersion] = useState(appVersion);
  const [status, setStatus] = useState<Status>(preview ? "preview" : "idle");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const updateRef = useRef<Update | null>(null);
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const lastCheckedRef = useRef(0);
  const lastNotifiedVersionRef = useRef<string | null>(null);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (preview) {
      if (!silent) toast.info("Les mises à jour sont désactivées dans cette préversion de test.");
      return;
    }
    if (!isTauri()) {
      if (!silent) toast.info("Les mises à jour nécessitent l'application Windows.");
      return;
    }
    if (checkingRef.current || installingRef.current) return;
    if (silent && (document.visibilityState === "hidden" || !navigator.onLine)) return;

    checkingRef.current = true;
    setStatus("checking");
    try {
      const candidate = await check();
      const previous = updateRef.current;
      updateRef.current = candidate;
      if (previous && previous !== candidate) {
        void previous.close().catch(() => undefined);
      }
      setAvailableVersion(candidate?.version ?? null);
      setReleaseNotes(candidate?.body ?? null);
      if (candidate) {
        setStatus("available");
        if (lastNotifiedVersionRef.current !== candidate.version) {
          lastNotifiedVersionRef.current = candidate.version;
          notifyDesktop(
            "Mise à jour disponible",
            "HébergTonServ Desktop v" + candidate.version + " est disponible.",
            "update",
          );
          toast.info("Mise à jour v" + candidate.version + " disponible.");
        }
      } else {
        setStatus("current");
        if (!silent) toast.success("HébergTonServ Desktop est à jour.");
      }
    } catch {
      setStatus(updateRef.current ? "available" : "error");
      if (!silent) toast.error("Recherche impossible. Vérifiez votre connexion et GitHub Releases.");
    } finally {
      checkingRef.current = false;
      const now = Date.now();
      lastCheckedRef.current = now;
      setCheckedAt(now);
    }
  }, [preview]);

  const installUpdate = useCallback(async () => {
    if (preview || !isTauri() || !updateRef.current || checkingRef.current || installingRef.current) return;
    installingRef.current = true;
    setStatus("installing");
    setDownloadedBytes(0);
    setTotalBytes(null);
    try {
      // Only this explicit user action starts installation. On Windows the
      // updater closes the app when it launches the signed installer.
      await updateRef.current.downloadAndInstall((event) => {
        if (event.event === "Started") setTotalBytes(event.data.contentLength ?? null);
        if (event.event === "Progress") setDownloadedBytes(value => value + event.data.chunkLength);
      });
      toast.info("L'installation est lancée. L'application peut se fermer sous Windows.");
      setStatus("available");
    } catch {
      toast.error("Installation impossible. La version actuellement installée reste utilisable.");
      setStatus("available");
    } finally {
      installingRef.current = false;
    }
  }, [preview]);

  useEffect(() => {
    if (!isTauri() || preview) return;
    void getVersion().then(setCurrentVersion).catch(() => undefined);
    const timeout = window.setTimeout(() => void checkForUpdates(true), UPDATE_STARTUP_DELAY_MS);
    const interval = window.setInterval(() => void checkForUpdates(true), UPDATE_CHECK_INTERVAL_MS);
    const onFocus = () => {
      if (Date.now() - lastCheckedRef.current >= UPDATE_FOCUS_MIN_AGE_MS) {
        void checkForUpdates(true);
      }
    };
    const onCheckRequested = () => void checkForUpdates(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("hts:check-for-updates", onCheckRequested);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("hts:check-for-updates", onCheckRequested);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [checkForUpdates, preview]);

  useEffect(() => () => {
    if (updateRef.current) void updateRef.current.close().catch(() => undefined);
  }, []);

  return (
    <UpdaterContext.Provider value={{
      currentVersion, status, availableVersion, releaseNotes,
      checkedAt, downloadedBytes, totalBytes, checkForUpdates, installUpdate,
    }}>
      {children}
    </UpdaterContext.Provider>
  );
}

export function useAppUpdater(): UpdaterContextValue {
  const context = useContext(UpdaterContext);
  if (!context) throw new Error("useAppUpdater requires AppUpdaterProvider");
  return context;
}
