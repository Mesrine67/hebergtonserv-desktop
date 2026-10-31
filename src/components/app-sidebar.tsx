import {
  AppWindow, KeyRound, LockKeyhole, ServerCog, Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { version as buildVersion } from "../../package.json";
import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const sections = [
  {
    title: "SSH",
    icon: KeyRound,
    items: [
      { title: "Clés SSH", url: "/ssh-keys" },
      { title: "Configuration", url: "/ssh-config" },
      { title: "Profils", url: "/profiles" },
    ],
  },
  {
    title: "Infrastructure",
    icon: ServerCog,
    items: [{ title: "Panels Wisp & Pterodactyl", url: "/panels" }],
  },
  {
    title: "Application",
    icon: Settings2,
    items: [
      { title: "Paramètres", url: "/settings" },
      { title: "Sécurité", url: "/security" },
    ],
  },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [version, setVersion] = useState(buildVersion);
  useEffect(() => {
    if (isTauri()) {
      getVersion().then(setVersion, () => setVersion(buildVersion));
    }
  }, []);
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="HébergTonServ Desktop">
              <Link to="/ssh-keys">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <AppWindow className="size-4" aria-hidden="true" />
                </span>
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">HébergTonServ</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">Desktop · Gestionnaire</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <NavMain items={sections} />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sécurité">
              <Link to="/security">
                <LockKeyhole className="size-4" />
                <span>Protection des accès</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-3 pb-1 text-[10px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          HébergTonServ Desktop · v{version}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
