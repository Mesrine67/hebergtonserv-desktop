import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { File, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { serverListRoute, serverSectionRoute } from "@/lib/panel-navigation";

type ExplorerTab = { panelId: string; serverIdentifier: string; label: string };
const STORAGE_KEY = "hts.server-explorer-tabs.v1";
function readTabs(): ExplorerTab[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((tab): tab is ExplorerTab => Boolean(tab && typeof tab.panelId === "string" && typeof tab.serverIdentifier === "string" && typeof tab.label === "string"));
  } catch { return []; }
}
function tabValue(tab: Pick<ExplorerTab, "panelId" | "serverIdentifier">) {
  return `${tab.panelId}\u0000${tab.serverIdentifier}`;
}

export function ServerExplorerTabs() {
  const [tabs, setTabs] = useState<ExplorerTab[]>(readTabs);
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeTab = useMemo(() => {
    const match = location.pathname.match(/^\/panel\/servers\/([^/]+)\/files$/);
    const panelId = params.get("panel");
    if (!match || !panelId) return "";
    let serverIdentifier = match[1];
    try { serverIdentifier = decodeURIComponent(serverIdentifier); } catch { /* Keep the route segment. */ }
    return tabValue({ panelId, serverIdentifier });
  }, [location.pathname, params]);

  useEffect(() => {
    const openTab = (event: Event) => {
      const detail = (event as CustomEvent<ExplorerTab>).detail;
      if (!detail?.panelId || !detail.serverIdentifier || !detail.label) return;
      setTabs(current => {
        const next = [...current.filter(tab => tabValue(tab) !== tabValue(detail)), detail];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Tabs remain available for this session. */ }
        return next;
      });
    };
    window.addEventListener("hts:file-explorer-open", openTab);
    return () => window.removeEventListener("hts:file-explorer-open", openTab);
  }, []);

  if (!tabs.length || !location.pathname.startsWith("/panel/servers/")) return null;

  function closeTab(tab: ExplorerTab) {
    const next = tabs.filter(item => tabValue(item) !== tabValue(tab));
    setTabs(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Closing the in-memory tab still works. */ }
    if (tabValue(tab) === activeTab) {
      const fallback = next[next.length - 1];
      navigate(fallback ? serverSectionRoute(fallback.panelId, fallback.serverIdentifier, "files") : serverListRoute(tab.panelId));
    }
  }

  const activeEntry = tabs.find(tab => tabValue(tab) === activeTab);

  return <div className="flex h-10 w-full min-w-0 shrink-0 items-end gap-1 overflow-hidden border-b bg-sidebar px-3" aria-label="Onglets des explorateurs de fichiers">
    <Tabs value={activeTab} onValueChange={value => {
      const tab = tabs.find(item => tabValue(item) === value);
      if (tab) navigate(serverSectionRoute(tab.panelId, tab.serverIdentifier, "files"));
    }} className="min-w-0 flex-1">
      <TabsList variant="line" className="h-9 w-max min-w-full justify-start overflow-x-auto rounded-none p-0">
        {tabs.map(tab => <TabsTrigger key={tabValue(tab)} value={tabValue(tab)} className="max-w-52 shrink-0 justify-start gap-2 px-3 data-active:after:bg-primary" title={`${tab.label} — explorateur de fichiers`}>
            <File data-icon="inline-start"/><span className="truncate">{tab.label}</span>
          </TabsTrigger>)}
      </TabsList>
    </Tabs>
    <Button type="button" variant="ghost" size="icon" className="mb-1 size-7 shrink-0" aria-label={activeEntry ? `Fermer l’explorateur ${activeEntry.label}` : "Fermer l’explorateur actif"} title="Fermer l’explorateur actif" disabled={!activeEntry} onClick={() => { if (activeEntry) closeTab(activeEntry); }}><X /></Button>
    <Button type="button" variant="ghost" size="icon" className="mb-1 size-7 shrink-0" aria-label="Ouvrir un autre explorateur de fichiers" title="Choisir un autre serveur" onClick={() => navigate(serverListRoute(params.get("panel")))}><Plus /></Button>
  </div>;
}
