import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, File, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { errorMessage } from "@/lib/error-message";
import { commands, type PanelFileEntry } from "@/lib/tauri";

type TreeProps = { panelId: string; serverId: string; path: string; selected: string | null; filter: string; showHidden: boolean; onSelect: (file: PanelFileEntry) => void };

/** Directory queries are isolated by panel, server and path; children load on expansion. */
export function PanelFileTree(props: TreeProps) {
  const files = useQuery({ queryKey: ["panel-server-files", props.panelId, props.serverId, props.path], queryFn: () => commands.listPanelServerFiles(props.panelId, props.serverId, props.path), staleTime: 15_000 });
  const visible = (files.data ?? []).filter(entry => (props.showHidden || !entry.name.startsWith(".")) && (entry.kind === "directory" || entry.name.toLocaleLowerCase().includes(props.filter.trim().toLocaleLowerCase()))).sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  if (files.isLoading) return <p className="p-2 text-xs text-muted-foreground">Chargement du dossier…</p>;
  if (files.isError) return <p role="alert" className="p-2 text-xs text-destructive">{errorMessage(files.error)}</p>;
  if (!visible.length) return <p className="p-2 text-xs text-muted-foreground">{files.data?.length ? "Aucun résultat dans ce dossier." : "Ce dossier est vide."}</p>;
  return <div className="flex flex-col">{visible.map(entry => entry.kind === "directory" ? <TreeFolder key={entry.path} entry={entry} {...props} /> : <Button key={entry.path} variant="ghost" size="sm" aria-current={props.selected === entry.path ? "true" : undefined} onClick={() => props.onSelect(entry)} className="h-8 w-full justify-start font-normal aria-[current=true]:bg-accent"><File data-icon="inline-start"/><span className="min-w-0 flex-1 truncate text-left">{entry.name}</span></Button>)}</div>;
}

function TreeFolder({ entry, ...props }: TreeProps & { entry: PanelFileEntry }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-full justify-start font-normal"><ChevronRight data-icon="inline-start" className={open ? "rotate-90" : undefined}/><Folder data-icon="inline-start"/><span className="truncate">{entry.name}</span></Button></CollapsibleTrigger>
    <CollapsibleContent><div className="ms-4 border-s ps-1">{open && <PanelFileTree {...props} path={entry.path}/>}</div></CollapsibleContent>
  </Collapsible>;
}
