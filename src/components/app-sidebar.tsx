import { GitBranch, KeyRound, ServerCog } from "lucide-react";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { version as buildVersion } from "../../package.json";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

const sections = [
  {
    title: "SSH", icon: KeyRound,
    items: [
      { title: "Clés SSH", url: "/ssh-keys" },
      { title: "Configuration", url: "/ssh-config" },
      { title: "Profils", url: "/profiles" },
    ],
  },
  {
    title: "Infrastructure", icon: ServerCog,
    items: [
      { title: "Panels", url: "/panels" },
      { title: "Compte du panel", url: "/panel/account" },
      { title: "Serveurs", url: "/panel/servers" },
    ],
  },
  {
    title: "Développement", icon: GitBranch,
    items: [{ title: "Git / GH", url: "/git" }],
  },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={sections} />
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
