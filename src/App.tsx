import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import StartupWelcome from "@/components/startup-welcome";
import WispLoginPage from "@/pages/WispLoginPage";
import { commands } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      type="button"
      aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function Workspace() {
  const location = useLocation();
  const current = routeLabels[location.pathname] ?? "Clés SSH";
  return (
    <SidebarProvider defaultOpen className="hts-workspace-shell h-dvh min-h-0 overflow-hidden bg-sidebar p-2 gap-2">
      <AppSidebar />
      <SidebarInset className="hts-workspace-panel min-h-0 min-w-0 h-full overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm md:!m-0 md:!ml-0 md:!rounded-2xl">
        <header className="hts-workspace-header sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <SidebarTrigger className="-ml-1" aria-label="Afficher ou masquer la navigation" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{current}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground sm:inline">
              HébergTonServ Desktop
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main id="workspace-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <div className="mx-auto w-full max-w-6xl">
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
              {welcomeVisible ? <StartupWelcome onDismiss={dismissWelcome} /> : authenticated ? <Workspace /> : <WispLoginPage onAuthenticated={onAuthenticated} />}
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
