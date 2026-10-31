import { ChevronRight, type LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type NavSection = {
  title: string;
  icon: LucideIcon;
  items: { title: string; url: string }[];
};

export function NavMain({ items }: { items: NavSection[] }) {
  const location = useLocation();
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((section) => {
          return (
            <Collapsible key={section.title} asChild defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={section.title} aria-label={"Afficher ou masquer " + section.title} onClick={() => { if (state === "collapsed") setOpen(true); }}>
                    <section.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{section.title}</span>
                    <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" aria-hidden="true" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {section.items.map((entry) => (
                      <SidebarMenuSubItem key={entry.url}>
                        <SidebarMenuSubButton asChild isActive={location.pathname === entry.url} aria-current={location.pathname === entry.url ? "page" : undefined}>
                          <NavLink to={entry.url} onClick={() => { if (isMobile) setOpenMobile(false); }}>
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
