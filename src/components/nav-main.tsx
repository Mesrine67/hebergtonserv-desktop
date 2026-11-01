import { ChevronRight, type LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";

export type NavSection = {
  title: string;
  icon: LucideIcon;
  items: { title: string; url: string }[];
};

export function NavMain({ items }: { items: NavSection[] }) {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  // On small screens the sidebar is a sheet, not the desktop icon rail.
  const iconMode = state === "collapsed" && !isMobile;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((section) => {
          const active = section.items.some((entry) => location.pathname === entry.url);
          if (iconMode) {
            return (
              <SidebarMenuItem key={section.title}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      aria-label={`Ouvrir le menu ${section.title}`}
                      aria-haspopup="menu"
                      isActive={active}
                      className="rounded-lg"
                    >
                      <section.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{section.title}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className="hts-floating-menu w-60"
                  >
                    <DropdownMenuLabel className="hts-floating-menu-label font-semibold">
                      {section.title}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {section.items.map((entry) => (
                      <DropdownMenuItem
                        key={entry.url}
                        asChild
                        className="hts-floating-menu-item"
                      >
                        <NavLink
                          to={entry.url}
                          aria-current={location.pathname === entry.url ? "page" : undefined}
                          className={location.pathname === entry.url ? "hts-floating-menu-current" : ""}
                        >
                          {entry.title}
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible key={section.title} asChild defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={section.title}
                    isActive={active}
                    aria-label={`Afficher ou masquer ${section.title}`}
                  >
                    <section.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{section.title}</span>
                    <ChevronRight
                      className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      aria-hidden="true"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {section.items.map((entry) => (
                      <SidebarMenuSubItem key={entry.url}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname === entry.url}
                          aria-current={location.pathname === entry.url ? "page" : undefined}
                        >
                          <NavLink
                            to={entry.url}
                            onClick={() => { if (isMobile) setOpenMobile(false); }}
                          >
                            <span>{entry.title}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
