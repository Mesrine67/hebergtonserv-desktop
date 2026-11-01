import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "@/lib/tauri";
import { isTauri } from "@tauri-apps/api/core";
import { Copy, Minus, Moon, Square, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { version as buildVersion } from "../../package.json";
import appIcon from "../../src-tauri/icons/128x128.png";
import { Button } from "@/components/ui/button";
import { AppUpdaterAction } from "@/components/app-updater-action";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  title?: string;
  navigation?: boolean;
};

function TitlebarSidebarRail() {
  const { state } = useSidebar();
  return (
    <div className={`hts-titlebar-rail flex h-full w-11 shrink-0 items-center justify-center bg-transparent ${state === "collapsed" ? "md:w-[var(--sidebar-width-icon)]" : "md:w-[var(--sidebar-width)] md:justify-start md:px-3"}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="size-8" aria-label="Afficher ou masquer la navigation" />
        </TooltipTrigger>
        <TooltipContent>Afficher ou masquer la navigation</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DesktopTitlebar({ title = "HébergTonServ Desktop", navigation = false }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const appWindow = useMemo(() => {
    try {
      return isTauri() ? getCurrentWindow() : null;
    } catch {
      return null;
    }
  }, []);
  const isDark = resolvedTheme !== "light";
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.windowMaximized = String(isMaximized);
    return () => {
      delete document.documentElement.dataset.windowMaximized;
    };
  }, [isMaximized]);

  useEffect(() => {
    if (!appWindow) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void appWindow.isMaximized().then((maximized) => {
      if (!cancelled) setIsMaximized(maximized);
    }).catch((error: unknown) => {
      console.error("[desktop-titlebar] isMaximized", error);
    });

    void appWindow.onResized(() => {
      void appWindow.isMaximized().then((maximized) => setIsMaximized(maximized)).catch((error: unknown) => {
        console.error("[desktop-titlebar] isMaximized", error);
      });
    }).then((dispose) => {
      if (cancelled) dispose();
      else unlisten = dispose;
    }).catch((error: unknown) => {
      console.error("[desktop-titlebar] onResized", error);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [appWindow]);

  function runWindowAction(action: "minimize" | "toggleMaximize" | "close") {
    if (!appWindow) return;
    if (action === "toggleMaximize") {
      void commands.toggleAppWindowMaximize().catch((error: unknown) => {
        console.error("[desktop-titlebar] toggle_app_window_maximize", error);
      });
      return;
    }
    void appWindow[action]().catch((error: unknown) => {
      console.error(`[desktop-titlebar] ${action}`, error);
    });
  }

  return (
    <header className="hts-titlebar relative z-[10001] flex h-11 shrink-0 items-center gap-0 border-0 bg-sidebar pr-2">
      {navigation && (
        <TitlebarSidebarRail />
      )}

      <div className="flex h-full min-w-0 flex-1 items-center gap-2 px-1" data-tauri-drag-region onDoubleClick={() => runWindowAction("toggleMaximize")}>
        <img src={appIcon} alt="" className="size-6 shrink-0 object-contain" aria-hidden="true" data-tauri-drag-region />
        <span className="truncate text-xs font-semibold text-foreground" data-tauri-drag-region>HébergTonServ Desktop</span>
        {navigation && (
          <>
            <span className="text-muted-foreground" aria-hidden="true" data-tauri-drag-region>·</span>
            <span className="truncate text-xs text-muted-foreground" data-tauri-drag-region>{title}</span>
          </>
        )}
        {!navigation && <span className="sr-only">v{buildVersion}</span>}
      </div>

      <AppUpdaterAction />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isDark ? "Thème clair" : "Thème sombre"}</TooltipContent>
      </Tooltip>

      {appWindow && (
        <div className="ml-1 flex h-full items-center pl-1">
          <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none" onClick={() => runWindowAction("minimize")} aria-label="Réduire la fenêtre">
            <Minus className="size-4" />
          </Button>
          <Button id="snap-btn" type="button" variant="ghost" size="icon" className="size-9 rounded-none" onClick={() => runWindowAction("toggleMaximize")} aria-label={isMaximized ? "Restaurer la fenêtre" : "Agrandir la fenêtre"} title={isMaximized ? "Restaurer" : "Agrandir"}>
            {isMaximized ? <Copy className="size-3.5" aria-hidden="true" /> : <Square className="size-3.5" aria-hidden="true" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-9 rounded-none hover:bg-destructive hover:text-destructive-foreground" onClick={() => runWindowAction("close")} aria-label="Fermer la fenêtre">
            <X className="size-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
