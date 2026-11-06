import * as ResizablePrimitive from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Group>) => (
  <ResizablePrimitive.Group className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)} {...props} />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({ withHandle, className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Separator> & { withHandle?: boolean }) => (
  <ResizablePrimitive.Separator className={cn("group relative mx-1 flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-transparent outline-none transition-colors after:absolute after:inset-y-1 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-border after:content-[''] hover:after:bg-primary focus-visible:after:bg-primary data-[separator]:touch-none data-[separator]:select-none data-[panel-group-direction=vertical]:mx-0 data-[panel-group-direction=vertical]:my-1 data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize data-[panel-group-direction=vertical]:after:inset-x-1 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:h-px data-[panel-group-direction=vertical]:after:w-auto data-[panel-group-direction=vertical]:after:-translate-y-1/2", className)} {...props}>
    {withHandle && <span className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border bg-border"><GripVertical className="size-2.5" /></span>}
  </ResizablePrimitive.Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
