import { ArrowDownToLine, CheckCircle2, History, LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppUpdater } from "@/lib/app-updater";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import "./update-badge.css";

export function AppUpdaterAction({ onOpenChangelog }: { onOpenChangelog?: () => void }) {
  const updater = useAppUpdater();
  const busy = updater.status === "checking" || updater.status === "installing";
  const available = Boolean(updater.availableVersion);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost"
              data-testid="update-toolbar-button"
              className="relative size-8 shrink-0"
              aria-label={available
                ? "Mise à jour v" + updater.availableVersion + " disponible"
                : "Mises à jour HébergTonServ"}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
              {available && (
                <span data-testid="update-notification-badge" className="hts-update-badge" aria-hidden="true">
                  <span className="hts-update-badge-dot" />
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{available ? "Nouvelle version disponible" : "Mises à jour HébergTonServ"}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-80 max-w-[calc(100vw-1rem)] border bg-popover p-2 shadow-xl">
        <DropdownMenuLabel className="text-xs font-semibold">Mises à jour de l'application</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-3 px-2 py-3 text-xs">
          <p className="text-muted-foreground">Version installée : <strong className="text-foreground">v{updater.currentVersion}</strong></p>
          {updater.status === "preview" ? (
            <p role="status" className="text-muted-foreground">Préversion de test : les mises à jour vers la version stable sont désactivées. Utilisez les releases Preview sur GitHub.</p>
          ) : available ? (
            <p role="status" className="flex items-center gap-2 text-foreground">
              <ArrowDownToLine className="size-4 shrink-0 text-primary" />
              Nouvelle version v{updater.availableVersion} disponible.
            </p>
          ) : updater.status === "current" ? (
            <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4" /> Vous utilisez la dernière version.</p>
          ) : updater.status === "error" ? (
            <p role="status" className="flex items-center gap-2 text-destructive"><WifiOff className="size-4" /> Vérification impossible. Réessayez plus tard.</p>
          ) : (
            <p className="text-muted-foreground">{busy ? "Vérification ou installation en cours…" : "Vérification automatique au démarrage et toutes les heures."}</p>
          )}
          {available && updater.releaseNotes && (
            <div className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border bg-secondary/20 p-2 leading-relaxed text-muted-foreground">
              {updater.releaseNotes}
            </div>
          )}
          {updater.status === "installing" && (
            <p role="status" aria-live="polite">Téléchargé : {(updater.downloadedBytes / 1048576).toFixed(1)} Mo
              {updater.totalBytes ? " / " + (updater.totalBytes / 1048576).toFixed(1) + " Mo" : ""}
            </p>
          )}
          {updater.status !== "preview" && (
            <Button id="hts-update-check" className="w-full" variant="outline" size="sm" disabled={busy}
              onClick={() => void updater.checkForUpdates(false)}>
              <RefreshCw className={"size-4 " + (busy ? "animate-spin" : "")} />
              {updater.status === "checking" ? "Vérification…" : "Vérifier maintenant"}
            </Button>
          )}
          {updater.status !== "preview" && available && (
            <Button className="w-full" size="sm" disabled={busy} onClick={() => void updater.installUpdate()}>
              <ArrowDownToLine className="size-4" /> Installer v{updater.availableVersion}
            </Button>
          )}
          {updater.checkedAt !== null && <p className="text-[11px] text-muted-foreground">
            Dernière vérification : {new Date(updater.checkedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>}
          {updater.status !== "preview" && <p className="text-[11px] text-muted-foreground">Détection automatique ; installation uniquement après confirmation.</p>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenChangelog?.()}>
          <History data-icon="inline-start" /> Nouveautés et changelog
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
