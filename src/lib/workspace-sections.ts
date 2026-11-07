import { GitBranch, KeyRound, ServerCog } from "lucide-react";
import type { NavSection } from "@/components/nav-main";
import { workspaceForPath, type WorkspaceId } from "@/components/workspace-switcher";

/**
 * Each workspace owns its navigation; unrelated sections never appear in
 * the sidebar. The route is the source of truth, even after Back/Forward.
 */
export const sectionsByWorkspace: Record<WorkspaceId, NavSection[]> = {
  infrastructure: [
    {
      title: "Infrastructure", icon: ServerCog,
      items: [
        { title: "Panels", url: "/panels" },
        { title: "Compte du panel", url: "/panel/account" },
        { title: "Serveurs", url: "/panel/servers" },
      ],
    },
  ],
  ssh: [
    {
      title: "SSH", icon: KeyRound,
      items: [
        { title: "Clés SSH", url: "/ssh-keys" },
        { title: "Configuration", url: "/ssh-config" },
        { title: "Profils", url: "/profiles" },
      ],
    },
  ],
  development: [
    {
      title: "Développement", icon: GitBranch,
      items: [{ title: "Git / GH", url: "/git" }, { title: "Assistant IA", url: "/assistant" }],
    },
  ],
};

export function sidebarSectionsForPath(pathname: string): NavSection[] {
  return sectionsByWorkspace[workspaceForPath(pathname)];
}
