import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { version as buildVersion } from "../../package.json";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { sidebarSectionsForPath } from "@/lib/workspace-sections";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const [version, setVersion] = useState(buildVersion);
  useEffect(() => {
    if (isTauri()) void getVersion().then(setVersion, () => setVersion(buildVersion));
  }, []);
  return (
    <Sidebar variant="sidebar" collapsible="icon" embedded className="hts-sidebar" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarSectionsForPath(pathname)} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
        <p className="px-3 pb-1 text-[10px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          HébergTonServ Desktop · v{version}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
