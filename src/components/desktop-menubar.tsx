import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowRight, BookOpen, Command, GitBranch, HelpCircle, Home, KeyRound, ListTree, Moon, PanelLeftClose, RefreshCw, ScrollText, Settings2, ShieldCheck, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent,
  MenubarItem, MenubarSeparator, MenubarShortcut,
} from "@/components/ui/menubar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceNavigation } from "@/lib/workspace-navigation";
import { isTauri } from "@tauri-apps/api/core";

export function DesktopMenubar() {
  const navigate = useNavigate();
  const history = useWorkspaceNavigation();
  const { toggleSidebar } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return (
    <div className="hts-desktop-navigation flex min-w-0 shrink-0 items-center gap-1 pl-2.5">
      <div className="flex items-center">
        <Tooltip><TooltipTrigger asChild>
          <Button size="icon-sm" variant="ghost" className="size-7" aria-label="Retour" disabled={!history.canBack} onClick={history.back}><ArrowLeft className="size-3.5" /></Button>
        </TooltipTrigger><TooltipContent>Retour · Alt + ←</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild>
          <Button size="icon-sm" variant="ghost" className="size-7" aria-label="Avancer" disabled={!history.canForward} onClick={history.forward}><ArrowRight className="size-3.5" /></Button>
        </TooltipTrigger><TooltipContent>Avancer · Alt + →</TooltipContent></Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="ml-1 size-7 shrink-0" aria-label="Afficher ou masquer la navigation" />
          </TooltipTrigger>
          <TooltipContent>Afficher ou masquer la navigation · Ctrl+B</TooltipContent>
        </Tooltip>
      </div>
      <Menubar className="hts-main-menubar h-8 gap-0 border-0 bg-transparent p-0 shadow-none">
        <MenubarMenu>
          <MenubarTrigger>Fichier</MenubarTrigger>
          <MenubarContent className="hts-desktop-menubar-menu min-w-52">
            <MenubarItem onSelect={() => navigate("/home")}><Home /> Accueil</MenubarItem>
            <MenubarItem onSelect={() => navigate("/ssh-keys")}><KeyRound /> Clés SSH</MenubarItem>
            <MenubarItem onSelect={() => navigate("/panels")}><Home /> Panels</MenubarItem>
            <MenubarItem onSelect={() => navigate("/git")}><GitBranch /> Git / GH</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={() => navigate("/settings")}><Settings2 /> Paramètres</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={() => { if (isTauri()) window.dispatchEvent(new Event("hts:request-close")); }} disabled={!isTauri()}>Fermer la fenêtre</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Modifier</MenubarTrigger>
          <MenubarContent className="hts-desktop-menubar-menu min-w-52">
            <MenubarItem disabled={!history.canBack} onSelect={history.back}>Retour <MenubarShortcut>Alt+←</MenubarShortcut></MenubarItem>
            <MenubarItem disabled={!history.canForward} onSelect={history.forward}>Avancer <MenubarShortcut>Alt+→</MenubarShortcut></MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={() => window.dispatchEvent(new Event("hts:open-discussion"))}>Ouvrir la discussion</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Affichage</MenubarTrigger>
          <MenubarContent className="hts-desktop-menubar-menu min-w-56">
            <MenubarItem onSelect={toggleSidebar}><PanelLeftClose /> Afficher / masquer la sidebar <MenubarShortcut>Ctrl+B</MenubarShortcut></MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun /> : <Moon />} {dark ? "Mode clair" : "Mode sombre"}</MenubarItem>
            <MenubarItem onSelect={() => navigate("/settings")}><Settings2 /> Thèmes et préférences</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Aide</MenubarTrigger>
          <MenubarContent className="hts-desktop-menubar-menu min-w-56">
            <MenubarItem onSelect={() => navigate("/documentation")}><BookOpen /> Documentation intégrée</MenubarItem>
            <MenubarItem onSelect={() => window.dispatchEvent(new Event("hts:open-discussion"))}><HelpCircle /> Discussion / assistance</MenubarItem>
            <MenubarItem onSelect={() => window.dispatchEvent(new Event("hts:open-shortcuts"))}><Command /> Afficher les raccourcis clavier <MenubarShortcut>Ctrl+/</MenubarShortcut></MenubarItem>
            <MenubarItem onSelect={() => window.dispatchEvent(new Event("hts:open-api-journal"))}><ScrollText /> Journal des API</MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled={!isTauri()} onSelect={() => window.dispatchEvent(new Event("hts:open-task-manager"))}><ListTree /> Gestionnaire de tâches</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={() => window.dispatchEvent(new Event("hts:check-for-updates"))}><RefreshCw /> Rechercher des mises à jour</MenubarItem>
            <MenubarItem onSelect={() => navigate("/security")}><ShieldCheck /> Sécurité</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}
