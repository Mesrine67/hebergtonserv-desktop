import * as ResizablePrimitive from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Group>) => (
  <ResizablePrimitive.Group className={cn("flex h-full min-h-0 min-w-0 w-full aria-[orientation=vertical]:flex-col", className)} {...props} />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({ withHandle, className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Separator> & { withHandle?: boolean }) => (
  <ResizablePrimitive.Separator className={cn("group relative flex h-full w-2 shrink-0 cursor-col-resize touch-none select-none items-center justify-center bg-transparent outline-none transition-colors after:absolute after:inset-y-1 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-border after:content-[''] hover:after:bg-foreground/30 focus-visible:after:bg-foreground/40 aria-[orientation=horizontal]:h-2 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:after:inset-x-1 aria-[orientation=horizontal]:after:inset-y-auto aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-px aria-[orientation=horizontal]:after:w-auto aria-[orientation=horizontal]:after:-translate-y-1/2", className)} {...props}>
    {withHandle && <span aria-hidden="true" className="pointer-events-none z-10 flex h-10 w-4 items-center justify-center rounded border bg-background text-muted-foreground shadow-sm group-hover:text-foreground group-focus-visible:text-foreground"><GripVertical className="size-3" /></span>}
  </ResizablePrimitive.Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
