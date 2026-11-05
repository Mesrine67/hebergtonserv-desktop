import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import StartupWelcome from "@/components/startup-welcome";
import WispLoginPage from "@/pages/WispLoginPage";
import { commands } from "@/lib/tauri";
import { version as buildVersion } from "../package.json";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DesktopTitlebar } from "@/components/desktop-titlebar";
import { AppUpdaterProvider } from "@/lib/app-updater";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeStyleProvider } from "@/lib/theme-style";
import { WorkspaceNavigationProvider } from "@/lib/workspace-navigation";
import { DesktopHelpPanels } from "@/components/desktop-help-panels";
import { DesktopTaskManager } from "@/components/desktop-task-manager";
import { recordAppEvent } from "@/lib/app-diagnostics";
import { useTheme } from "next-themes";
import { PanelDiagnostics } from "@/components/panel-diagnostics";
import { ServerExplorerTabs } from "@/components/server-explorer-tabs";
import "./App.css";
import "./theme-presets.css";
import "./welcome-motion.css";
import "./desktop-polish.css";
import "./desktop-next.css";
import "./shadcn-style-modes.css";

// Route-level splitting keeps the cold-start WebView bundle small.
const HomePage = lazy(() => import("@/pages/HomePage"));
const GitHubPage = lazy(() => import("@/pages/GitHubPage"));
const DocumentationPage = lazy(() => import("@/pages/DocumentationPage"));
const SshKeysPage = lazy(() => import("./pages/SshKeysPage"));
const SshConfigPage = lazy(() => import("./pages/SshConfigPage"));
const PanelsPage = lazy(() => import("./pages/PanelsPage"));
const ProfilesPage = lazy(() => import("./pages/ProfilesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const PanelAccountPage = lazy(() => import("./pages/PanelAccountPage"));
const PanelServersPage = lazy(() => import("./pages/PanelServersPage"));
const ServerConsolePage = lazy(() => import("./pages/ServerConsolePage"));
const ServerManagementPage = lazy(() => import("./pages/ServerManagementPage"));

const queryClient = new QueryClient();

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster
    richColors
    closeButton
    position="bottom-right"
    theme={resolvedTheme === "light" ? "light" : "dark"}
    toastOptions={{ className: "border-border bg-card text-card-foreground", descriptionClassName: "text-muted-foreground" }}
  />;
}

const routeLabels: Record<string, string> = {
  "/home": "Accueil",
  "/documentation": "Documentation",
  "/ssh-keys": "Clés SSH",
  "/ssh-config": "Configuration SSH",
  "/profiles": "Profils SSH",
  "/panels": "Panels",
  "/panel/account": "Compte du panel",
  "/panel/servers": "Serveurs",
  "/settings": "Paramètres",
  "/security": "Sécurité",
  "/git": "Git / GH",
};

function Workspace() {
  const [apiJournalOpen, setApiJournalOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const openJournal = () => setApiJournalOpen(true);
    window.addEventListener("hts:open-api-journal", openJournal);
    return () => window.removeEventListener("hts:open-api-journal", openJournal);
  }, []);
  useEffect(() => {
    document.getElementById("workspace-scroll")?.scrollTo({ top: 0 });
    recordAppEvent("navigation", "route_changed");
  }, [location.pathname]);
  const current = routeLabels[location.pathname] ?? (location.pathname.endsWith("/files") ? "Fichiers du serveur" : location.pathname.endsWith("/databases") ? "Bases de données du serveur" : location.pathname.startsWith("/panel/servers/") ? "Console serveur" : "Clés SSH");
  return (
    <SidebarProvider defaultOpen className="hts-workspace-shell h-dvh min-h-0 flex-col overflow-hidden bg-sidebar">
      <WorkspaceNavigationProvider>
      <DesktopTitlebar navigation title={current} />
      <ServerExplorerTabs />
      <DesktopHelpPanels />
      <DesktopTaskManager />
      <PanelDiagnostics open={apiJournalOpen} onOpenChange={setApiJournalOpen} />
      <div className="hts-workspace-body flex min-h-0 flex-1 overflow-hidden">
      <AppSidebar />
      <SidebarInset className="hts-workspace-panel min-h-0 min-w-0 overflow-hidden bg-background">
        <main id="workspace-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <div className={`mx-auto w-full ${["/panel/servers", "/panel/account"].includes(location.pathname) ? "max-w-screen-2xl" : "max-w-6xl"}`}>
            <div key={location.pathname} className="hts-route-scene">
            <Suspense fallback={<p role="status" className="px-4 py-6 text-sm text-muted-foreground">Chargement de la page…</p>}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/documentation" element={<DocumentationPage />} />
              <Route path="/ssh-keys" element={<SshKeysPage />} />
              <Route path="/ssh-config" element={<SshConfigPage />} />
              <Route path="/profiles" element={<ProfilesPage />} />
              <Route path="/panels" element={<PanelsPage />} />
              <Route path="/panel/account" element={<PanelAccountPage />} />
              <Route path="/panel/servers" element={<PanelServersPage />} />
              <Route path="/panel/servers/:identifier" element={<ServerConsolePage />} />
              <Route path="/panel/servers/:identifier/files" element={<ServerManagementPage section="files" />} />
              <Route path="/panel/servers/:identifier/databases" element={<ServerManagementPage section="databases" />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/git" element={<GitHubPage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
            </Suspense>
            </div>
          </div>
        </main>
      </SidebarInset>
      </div>
      </WorkspaceNavigationProvider>
    </SidebarProvider>
  );
}

export default function App() {
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [introAnimationStarted, setIntroAnimationStarted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const [entering, setEntering] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    function requestClose() {
      if (!isTauri() || closingRef.current) return;
      closingRef.current = true;
      recordAppEvent("lifecycle", "close_requested");
      setIsClosing(true);
      window.setTimeout(() => {
        void invoke("finish_main_window_close").catch((error: unknown) => {
          console.error("[desktop] close", error);
        }).finally(() => {
          closingRef.current = false;
          setIsClosing(false);
        });
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 510);
    }
    window.addEventListener("hts:request-close", requestClose);
    // Native close requests (Alt+F4 / Windows) also use the animated path.
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      void listen("hts:request-close", requestClose).then((stop) => {
        if (disposed) stop(); else unlisten = stop;
      }).catch(() => undefined);
    }
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("hts:request-close", requestClose);
    };
  }, []);
  const dismissWelcome = useCallback(() => setWelcomeVisible(false), []);

  useEffect(() => {
    // WebView2 can finish its first React render while the native window is still hidden.
    // Start the handwriting 500ms after Tauri confirms the window was shown.
    let disposed = false;
    let secondFrame = 0;
    let animationTimer = 0;
    const beginAfterWindowShown = () => {
      if (disposed) return;
      animationTimer = window.setTimeout(() => {
        if (!disposed) setIntroAnimationStarted(true);
      }, 500);
    };
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!isTauri()) {
          beginAfterWindowShown();
          return;
        }
        recordAppEvent("lifecycle", "window_ready");
        void invoke("show_ready_main_window").then(beginAfterWindowShown).catch((error: unknown) => {
          console.error("[desktop] ready window", error);
          // Never leave the introduction stuck if the native acknowledgement fails.
          beginAfterWindowShown();
        });
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(animationTimer);
    };
  }, []);
  const onAuthenticated = useCallback(() => {
    recordAppEvent("auth", "session_authenticated");
    try { window.localStorage.setItem("hts-last-authenticated-version", buildVersion); } catch { /* private storage unavailable */ }
    setAuthenticated(true);
  }, []);
  useEffect(() => {
    void commands.listPanels().then(async (panels) => {
      const saved = panels.find((panel) => panel.status === "ok");
      // A new installed version requires explicit user reauthentication.
      const validatedVersion = (() => { try { return window.localStorage.getItem("hts-last-authenticated-version"); } catch { return null; } })();
      if (validatedVersion === buildVersion && saved && await commands.panelTokenConfigured(saved.id)) setAuthenticated(true);
    }).catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="hts-ui-theme">
        <ThemeStyleProvider>
          <AppUpdaterProvider>
          <TooltipProvider delayDuration={150}>
            <BrowserRouter>
              <div data-window-closing={isClosing ? "true" : undefined} className="hts-window-boot relative h-dvh min-h-0 overflow-hidden bg-background">
                {!welcomeVisible && (
                  <div className="hts-app-scene" data-entering={entering ? "true" : undefined}>
                    {authenticated ? <Workspace /> : (
                      <div className="flex h-dvh min-h-0 flex-col bg-background">
                        <DesktopTitlebar title="Connexion" />
                        <div className="flex min-h-0 flex-1">
                          <WispLoginPage onAuthenticated={onAuthenticated} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {welcomeVisible && (
                  <div className="hts-intro-overlay" data-leaving={entering ? "true" : undefined}>
                    <DesktopTitlebar welcome />
                    <div className="relative min-h-0 flex-1">
                      <StartupWelcome onEnter={() => setEntering(true)} onDismiss={dismissWelcome} startAnimation={introAnimationStarted} />
                    </div>
                  </div>
                )}
              </div>
            </BrowserRouter>
            <ThemeAwareToaster />
          </TooltipProvider>
          </AppUpdaterProvider>
        </ThemeStyleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
