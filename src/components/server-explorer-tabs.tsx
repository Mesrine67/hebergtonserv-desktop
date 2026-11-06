import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { File, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serverListRoute, serverSectionRoute } from "@/lib/panel-navigation";
import { toast } from "sonner";

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
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(() => new Set());
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

  useEffect(() => {
    const updateDraft = (event: Event) => {
      const detail = (event as CustomEvent<{ panelId: string; serverIdentifier: string; dirty: boolean }>).detail;
      if (!detail?.panelId || !detail.serverIdentifier) return;
      const key = tabValue(detail);
      setDirtyTabs(current => {
        const next = new Set(current);
        if (detail.dirty) next.add(key);
        else next.delete(key);
        return next;
      });
    };
    window.addEventListener("hts:file-explorer-draft-change", updateDraft);
    return () => window.removeEventListener("hts:file-explorer-draft-change", updateDraft);
  }, []);

  const showTabs = tabs.length > 0 && location.pathname.startsWith("/panel/servers/");

  function closeTab(tab: ExplorerTab) {
    if (dirtyTabs.has(tabValue(tab))) {
      toast.warning("Enregistrez ou annulez les modifications avant de fermer cet onglet.");
      return;
    }
    const next = tabs.filter(item => tabValue(item) !== tabValue(tab));
    setTabs(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Closing the in-memory tab still works. */ }
    if (tabValue(tab) === activeTab) {
      const fallback = next[next.length - 1];
      navigate(fallback ? serverSectionRoute(fallback.panelId, fallback.serverIdentifier, "files") : serverListRoute(tab.panelId));
    }
  }

  return <div className="hts-titlebar-tabs flex h-full min-w-0 flex-1 items-center gap-1 px-1" aria-label={showTabs ? "Onglets des explorateurs de fichiers" : undefined}>
    {showTabs && <div role="tablist" aria-label="Explorateurs de fichiers ouverts" className="flex h-full min-w-0 items-center gap-1 overflow-x-auto">
      {tabs.map(tab => {
        const value = tabValue(tab);
        const selected = value === activeTab;
        return <div key={value} className={`group flex h-8 max-w-60 min-w-32 shrink-0 items-center rounded-t-md border border-b-0 ${selected ? "border-border bg-background" : "border-transparent bg-transparent hover:bg-accent/60"}`}>
          <button type="button" role="tab" aria-selected={selected} className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left text-xs" title={`${tab.label} — explorateur de fichiers${dirtyTabs.has(value) ? " (modifications non enregistrées)" : ""}`} onClick={() => navigate(serverSectionRoute(tab.panelId, tab.serverIdentifier, "files"))}>
            <File className="size-3.5 shrink-0" /><span className="truncate">{tab.label}</span>{dirtyTabs.has(value) && <span aria-label="Modifications non enregistrées" className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
          </button>
          <Button type="button" variant="ghost" size="icon" className="mr-1 size-6 shrink-0 opacity-60 hover:opacity-100" aria-label={`Fermer l’explorateur ${tab.label}`} title={`Fermer ${tab.label}`} onClick={() => closeTab(tab)}><X /></Button>
        </div>;
      })}
    </div>}
    {showTabs && <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Ouvrir un autre explorateur de fichiers" title="Choisir un autre serveur" onClick={() => navigate(serverListRoute(params.get("panel")))}><Plus /></Button>}
    <div className="hts-titlebar-drag h-full min-w-2 flex-1 self-stretch" data-tauri-drag-region aria-hidden="true" />
  </div>;
}
