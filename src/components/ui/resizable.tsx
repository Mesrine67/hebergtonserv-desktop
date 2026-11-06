import * as ResizablePrimitive from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Group>) => (
  <ResizablePrimitive.Group className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)} {...props} />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({ withHandle, className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Separator> & { withHandle?: boolean }) => (
  <ResizablePrimitive.Separator className={cn("relative flex w-px shrink-0 items-center justify-center bg-border outline-none transition-colors after:absolute after:inset-y-0 after:-left-1.5 after:w-3 hover:bg-primary/50 focus-visible:bg-primary data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:inset-x-0 data-[panel-group-direction=vertical]:after:-top-1.5 data-[panel-group-direction=vertical]:after:h-3", className)} {...props}>
    {withHandle && <span className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border bg-border"><GripVertical className="size-2.5" /></span>}
  </ResizablePrimitive.Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
