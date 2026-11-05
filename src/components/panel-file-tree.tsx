import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, File, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { errorMessage } from "@/lib/error-message";
import { commands, type PanelFileEntry } from "@/lib/tauri";

type TreeProps = { panelId: string; serverId: string; path: string; selected: string | null; filter: string; showHidden: boolean; onSelect: (file: PanelFileEntry) => void };

/** Directory queries are isolated by panel, server and path; children load on expansion. */
export function PanelFileTree(props: TreeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const files = useQuery({ queryKey: ["panel-server-files", props.panelId, props.serverId, props.path], queryFn: () => commands.listPanelServerFiles(props.panelId, props.serverId, props.path), staleTime: 15_000 });
  const visible = (files.data ?? []).filter(entry => (props.showHidden || !entry.name.startsWith(".")) && (entry.kind === "directory" || entry.name.toLocaleLowerCase().includes(props.filter.trim().toLocaleLowerCase()))).sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  useEffect(() => setActiveIndex(index => Math.min(index, Math.max(0, visible.length - 1))), [visible.length, props.path, props.filter, props.showHidden]);
  if (files.isLoading) return <p className="p-2 text-xs text-muted-foreground">Chargement du dossier…</p>;
  if (files.isError) return <p role="alert" className="p-2 text-xs text-destructive">{errorMessage(files.error)}</p>;
  if (!visible.length) return <p className="p-2 text-xs text-muted-foreground">{files.data?.length ? "Aucun résultat dans ce dossier." : "Ce dossier est vide."}</p>;

  const activate = (entry: PanelFileEntry) => {
    if (entry.kind === "directory") {
      setActiveIndex(visible.findIndex(item => item.path === entry.path));
      document.getElementById(`tree-folder-${entry.path}`)?.click();
    }
    else props.onSelect(entry);
  };
  const onTreeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!visible.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); setActiveIndex(event.key === "Home" ? 0 : visible.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      if (visible[activeIndex]) { event.preventDefault(); activate(visible[activeIndex]); }
    } else if (event.key === "ArrowRight" && visible[activeIndex]?.kind === "directory") {
      event.preventDefault();
      const folder = document.getElementById(`tree-folder-${visible[activeIndex].path}`);
      if (folder?.getAttribute("aria-expanded") === "false") folder.click();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (props.path !== "/") {
        document.getElementById(`tree-folder-${props.path}`)?.focus();
      } else if (visible[activeIndex]?.kind === "directory") {
        const folder = document.getElementById(`tree-folder-${visible[activeIndex].path}`);
        if (folder?.getAttribute("aria-expanded") === "true") folder.click();
      }
    }
  };
  return <div role="tree" aria-label={`Fichiers dans ${props.path}`} onKeyDown={onTreeKeyDown} className="flex flex-col">{visible.map((entry, index) => entry.kind === "directory" ? <TreeFolder key={entry.path} entry={entry} active={index === activeIndex} onActivate={() => setActiveIndex(index)} {...props} /> : <Button key={entry.path} role="treeitem" tabIndex={index === activeIndex ? 0 : -1} variant="ghost" size="sm" aria-current={props.selected === entry.path ? "true" : undefined} onFocus={() => setActiveIndex(index)} onClick={() => props.onSelect(entry)} className="h-8 w-full justify-start font-normal aria-[current=true]:bg-accent"><File data-icon="inline-start"/><span className="min-w-0 flex-1 truncate text-left">{entry.name}</span></Button>)}</div>;
}

function TreeFolder({ entry, active, onActivate, ...props }: TreeProps & { entry: PanelFileEntry; active: boolean; onActivate: () => void }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild><Button id={`tree-folder-${entry.path}`} role="treeitem" tabIndex={active ? 0 : -1} aria-expanded={open} variant="ghost" size="sm" onFocus={onActivate} className="h-8 w-full justify-start font-normal"><ChevronRight data-icon="inline-start" className={open ? "rotate-90" : undefined}/><Folder data-icon="inline-start"/><span className="truncate">{entry.name}</span></Button></CollapsibleTrigger>
    <CollapsibleContent><div className="ms-4 border-s ps-1">{open && <PanelFileTree {...props} path={entry.path}/>}</div></CollapsibleContent>
  </Collapsible>;
}
