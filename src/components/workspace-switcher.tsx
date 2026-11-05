import { Check, ChevronsUpDown, GitBranch, KeyRound, ServerCog } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type WorkspaceId = "infrastructure" | "ssh" | "development";

const spaces = [
  { id: "infrastructure", title: "HébergTonServ", subtitle: "Infrastructure", path: "/panel/servers", icon: ServerCog },
  { id: "ssh", title: "SSH", subtitle: "Clés, connexions et profils", path: "/ssh-keys", icon: KeyRound },
  { id: "development", title: "Développement", subtitle: "Git et GitHub", path: "/git", icon: GitBranch },
] as const;

export function workspaceForPath(pathname: string): WorkspaceId {
  if (pathname.startsWith("/ssh-") || pathname === "/profiles") return "ssh";
  if (pathname === "/git") return "development";
  return "infrastructure";
}

/** Desktop workspace menus fly out beside the rail, mobile menus open below. */
export function workspaceMenuSide(isMobile: boolean): "right" | "bottom" {
  return isMobile ? "bottom" : "right";
}

export function WorkspaceSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const selected = spaces.find(space => space.id === workspaceForPath(location.pathname)) ?? spaces[0];
  const SelectedIcon = selected.icon;
  return (
    <SidebarMenu className="min-w-0">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip="Choisir un espace" className="hts-workspace-switcher h-12 border border-sidebar-border/40 data-[state=open]:bg-sidebar-accent">
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent">
                {selected.id === "infrastructure"
                  ? <img src="/hebergtonserv-mark.png" alt="" className="size-full object-contain"/>
                  : <SelectedIcon className="size-4 text-sidebar-foreground" aria-hidden="true"/>}
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{selected.title}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">{selected.subtitle}</span>
              </span>
              <ChevronsUpDown className="ms-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={workspaceMenuSide(isMobile)}
            align="start"
            sideOffset={10}
            collisionPadding={12}
            className="hts-floating-menu hts-workspace-popup w-64"
          >
            <DropdownMenuLabel className="hts-floating-menu-label text-xs">Espaces de travail</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {spaces.map((space, i) => {
                const Icon = space.icon;
                return (
                  <DropdownMenuItem
                    key={space.id}
                    className="hts-floating-menu-item"
                    aria-current={selected.id === space.id ? "page" : undefined}
                    onSelect={() => {
                      navigate(space.path);
                      if (isMobile) setOpenMobile(false);
                    }}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                      {space.id === "infrastructure"
                        ? <img src="/hebergtonserv-mark.png" alt="" className="size-6 object-contain"/>
                        : <Icon className="size-4" aria-hidden="true" />}
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{space.title}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{space.subtitle}</span>
                    </span>
                    {selected.id === space.id
                      ? <Check className="size-4 shrink-0 text-primary" aria-label="Espace sélectionné" />
                      : <span className="text-[10px] text-muted-foreground">{i + 1}</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
