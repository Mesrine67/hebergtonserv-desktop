import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import StartupWelcome from "@/components/startup-welcome";
import WispLoginPage from "@/pages/WispLoginPage";
import { commands } from "@/lib/tauri";
import { DesktopTitlebar } from "@/components/desktop-titlebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import SshKeysPage from "./pages/SshKeysPage";
import SshConfigPage from "./pages/SshConfigPage";
import PanelsPage from "./pages/PanelsPage";
import ProfilesPage from "./pages/ProfilesPage";
import SettingsPage from "./pages/SettingsPage";
import SecurityPage from "./pages/SecurityPage";
import PanelAccountPage from "./pages/PanelAccountPage";
import PanelServersPage from "./pages/PanelServersPage";
import "./App.css";

const queryClient = new QueryClient();

const routeLabels: Record<string, string> = {
  "/ssh-keys": "Clés SSH",
  "/ssh-config": "Configuration SSH",
  "/profiles": "Profils SSH",
  "/panels": "Panels",
  "/panel/account": "Compte du panel",
  "/panel/servers": "Serveurs",
  "/settings": "Paramètres",
  "/security": "Sécurité",
};

function Workspace() {
  const location = useLocation();
  const current = routeLabels[location.pathname] ?? "Clés SSH";
  return (
    <SidebarProvider defaultOpen className="hts-workspace-shell h-dvh min-h-0 flex-col overflow-hidden bg-sidebar">
      <DesktopTitlebar navigation title={current} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <AppSidebar />
      <SidebarInset className="hts-workspace-panel min-h-0 min-w-0 h-full overflow-hidden bg-background">
        <main id="workspace-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <div className={`mx-auto w-full ${location.pathname === "/panel/servers" ? "max-w-screen-2xl" : "max-w-6xl"}`}>
            <Routes>
              <Route path="/" element={<Navigate to="/ssh-keys" replace />} />
              <Route path="/ssh-keys" element={<SshKeysPage />} />
              <Route path="/ssh-config" element={<SshConfigPage />} />
              <Route path="/profiles" element={<ProfilesPage />} />
              <Route path="/panels" element={<PanelsPage />} />
              <Route path="/panel/account" element={<PanelAccountPage />} />
              <Route path="/panel/servers" element={<PanelServersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="*" element={<Navigate to="/ssh-keys" replace />} />
            </Routes>
          </div>
        </main>
      </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const dismissWelcome = useCallback(() => setWelcomeVisible(false), []);
  const onAuthenticated = useCallback(() => setAuthenticated(true), []);
  useEffect(() => {
    void commands.listPanels().then(async (panels) => {
      const saved = panels.find((panel) => panel.status === "ok");
      if (saved && await commands.panelTokenConfigured(saved.id)) setAuthenticated(true);
    }).catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="hts-ui-theme">
        <TooltipProvider delayDuration={150}>
          <BrowserRouter>
              {welcomeVisible ? (
                <div className="flex h-dvh min-h-0 flex-col bg-background">
                  <DesktopTitlebar />
                  <div className="relative min-h-0 flex-1">
                    <StartupWelcome onDismiss={dismissWelcome} />
                  </div>
                </div>
              ) : authenticated ? <Workspace /> : (
                <div className="flex h-dvh min-h-0 flex-col bg-background">
                  <DesktopTitlebar title="Connexion" />
                  <div className="flex min-h-0 flex-1">
                    <WispLoginPage onAuthenticated={onAuthenticated} />
                  </div>
                </div>
              )}
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
