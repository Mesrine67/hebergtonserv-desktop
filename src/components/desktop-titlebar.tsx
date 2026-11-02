import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "@/lib/tauri";
import { isTauri } from "@tauri-apps/api/core";
import { Copy, Minus, Moon, Square, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { version as buildVersion } from "../../package.json";
import { Button } from "@/components/ui/button";
import { AppUpdaterAction } from "@/components/app-updater-action";
import { DiscussionAction } from "@/components/discussion-action";
import { NotificationsAction } from "@/components/notifications-action";
import { DesktopMenubar } from "@/components/desktop-menubar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  title?: string;
  navigation?: boolean;
  welcome?: boolean;
};

function TitlebarSidebarRail() {
  // Window chrome is not part of the collapsible navigation column.
  // Keep the application title anchored in both navigation states.
  return (
    <div className="hts-titlebar-rail flex h-full w-[var(--sidebar-width-icon)] shrink-0 items-center justify-center bg-transparent">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="size-8" aria-label="Afficher ou masquer la navigation" />
        </TooltipTrigger>
        <TooltipContent>Afficher ou masquer la navigation</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DesktopTitlebar({ navigation = false, welcome = false }: Props) {
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
    if (action === "close") {
      window.dispatchEvent(new Event("hts:request-close"));
      return;
    }
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
    <header className={`hts-titlebar relative z-[10001] flex h-11 shrink-0 items-center gap-0 border-0 bg-sidebar pr-2 ${welcome ? "hts-titlebar--welcome" : ""}`}>
      {navigation && (
        <TitlebarSidebarRail />
      )}

      <span className="sr-only">HébergTonServ Desktop v{buildVersion}</span>
      {navigation && <DesktopMenubar />}
      <div className="hts-titlebar-drag min-w-2 flex-1 self-stretch" data-tauri-drag-region onDoubleClick={() => runWindowAction("toggleMaximize")} />

      {navigation && <NotificationsAction />}
      <DiscussionAction />
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
          <Button type="button" variant="ghost" size="icon" className="hts-window-control size-8" onClick={() => runWindowAction("minimize")} aria-label="Réduire la fenêtre">
            <Minus className="size-4" />
          </Button>
          <Button id="snap-btn" type="button" variant="ghost" size="icon" className="hts-window-control size-8" onClick={() => runWindowAction("toggleMaximize")} aria-label={isMaximized ? "Restaurer la fenêtre" : "Agrandir la fenêtre"} title={isMaximized ? "Restaurer" : "Agrandir"}>
            {isMaximized ? <Copy className="size-3.5" aria-hidden="true" /> : <Square className="size-3.5" aria-hidden="true" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="hts-window-control size-8 hover:bg-destructive/80 hover:text-destructive-foreground" onClick={() => runWindowAction("close")} aria-label="Fermer la fenêtre">
            <X className="size-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
