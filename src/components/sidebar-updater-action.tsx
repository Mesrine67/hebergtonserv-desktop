import { useEffect, useState } from "react";
import { ArrowDownToLine, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { version as buildVersion } from "../../package.json";

export function SidebarUpdaterAction() {
  const [current, setCurrent] = useState(buildVersion);
  const [available, setAvailable] = useState<Update | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    void getVersion().then(setCurrent, () => {});
  }, []);

  async function checkForUpdates() {
    if (!isTauri()) { toast.info("Les mises à jour nécessitent l'application Windows."); return; }
    setBusy(true);
    try {
      const candidate = await check();
      if (available) await available.close();
      setAvailable(candidate);
      setChecked(true);
      if (candidate) toast.info(`Mise à jour ${candidate.version} disponible`);
      else toast.success("HébergTonServ Desktop est à jour.");
    } catch {
      toast.error("Recherche impossible. Vérifiez votre connexion et GitHub Releases.");
    } finally { setBusy(false); }
  }

  async function install() {
    if (!available || !isTauri()) return;
    setBusy(true);
    setProgress(0);
    try {
      await available.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          setProgress((old) => old + event.data.chunkLength);
        }
      });
      toast.info("Mise à jour installée. Redémarrez l'application si nécessaire.");
    } catch {
      toast.error("Installation impossible. L'application actuelle reste utilisable.");
    } finally { setBusy(false); }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="outline"
              className="relative size-8 shrink-0 border-sidebar-border"
              aria-label={available ? `Mise à jour ${available.version} disponible` : "Mises à jour HébergTonServ"}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
              {available && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">Mises à jour HébergTonServ</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-72 border bg-popover p-2 shadow-xl">
        <DropdownMenuLabel className="text-xs font-semibold">Mises à jour de l'application</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-3 px-2 py-3 text-xs">
          <p className="text-muted-foreground">Version installée : <strong className="text-foreground">v{current}</strong></p>
          {available ? (
            <p className="flex items-center gap-2 text-foreground">
              <ArrowDownToLine className="size-4 shrink-0 text-primary" />
              Nouvelle version v{available.version} disponible
            </p>
          ) : checked ? (
            <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4" /> Aucune mise à jour disponible.</p>
          ) : (
            <p className="text-muted-foreground">Recherchez une version Windows signée sur GitHub.</p>
          )}
          {progress > 0 && <p aria-live="polite">Téléchargé : {(progress / 1048576).toFixed(1)} Mo</p>}
          <Button className="w-full" variant="outline" size="sm" disabled={busy}
            onClick={() => void checkForUpdates()}>
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Opération en cours…" : "Vérifier maintenant"}
          </Button>
          {available && (
            <Button className="w-full" size="sm" disabled={busy} onClick={() => void install()}>
              <ArrowDownToLine className="size-4" /> Installer v{available.version}
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">Aucune installation sans votre confirmation.</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
