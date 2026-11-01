import {
  KeyRound, ServerCog, Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { version as buildVersion } from "../../package.json";
import { NavMain } from "@/components/nav-main";
import appIcon from "../../src-tauri/icons/128x128.png";
import { NavUser } from "@/components/nav-user";
import { SidebarUpdaterAction } from "@/components/sidebar-updater-action";
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
    <Sidebar variant="floating" collapsible="icon" className="hts-sidebar" {...props}>
      <SidebarHeader>
        <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <SidebarMenu className="min-w-0 flex-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="HébergTonServ Desktop">
              <Link to="/ssh-keys">
                <img src={appIcon} alt="" className="size-8 shrink-0 rounded-lg object-contain group-data-[collapsible=icon]:size-7" aria-hidden="true" />
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">HébergTonServ</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">Desktop · Gestionnaire</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex shrink-0 items-center justify-center group-data-[collapsible=icon]:w-full"><SidebarUpdaterAction /></div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <NavMain items={sections} />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <NavUser />
        <p className="px-3 pb-1 text-[10px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          HébergTonServ Desktop · v{version}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
