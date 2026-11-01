import { useEffect, useState } from "react";
import { ChevronsUpDown, Computer, KeyRound, Settings2, ShieldCheck } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Link } from "react-router-dom";
import {
  Avatar, AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { version as buildVersion } from "../../package.json";

type LocalIdentity = { username: string; hostname: string };

export function NavUser() {
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [version, setVersion] = useState(buildVersion);

  useEffect(() => {
    if (!isTauri()) return;
    void invoke<LocalIdentity>("get_local_identity").then(setIdentity, () => {});
    void getVersion().then(setVersion, () => {});
  }, []);

  const displayName = identity?.username || "Session locale";
  const hostname = identity?.hostname || "Appareil Windows";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip="Menu utilisateur"
              className="hts-user-menu-trigger ml-1 h-12 w-[calc(100%-0.25rem)] border border-transparent aria-expanded:border-sidebar-border aria-expanded:bg-sidebar-accent/60 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:w-full"
              aria-label={`Menu de ${displayName}`}
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  <Computer className="size-4" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-semibold">{displayName}</span>
                <span className="truncate text-[11px] text-muted-foreground">{hostname} · local</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" alignOffset={10} sideOffset={8} className="w-60 border bg-popover p-1.5 shadow-xl">
            <DropdownMenuLabel className="flex items-center gap-2 p-2 font-normal">
              <Avatar className="size-9 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary"><Computer className="size-4" /></AvatarFallback>
              </Avatar>
              <span className="grid min-w-0">
                <span className="truncate text-xs font-semibold">{displayName}</span>
                <span className="truncate text-[11px] text-muted-foreground">{hostname}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings"><Settings2 className="size-4" />Paramètres</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/security"><ShieldCheck className="size-4" />Sécurité</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/ssh-keys"><KeyRound className="size-4" />Mes clés SSH</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
              HébergTonServ Desktop · v{version}<br />
              Informations locales uniquement, aucun compte en ligne.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
