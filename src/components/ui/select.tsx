import * as React from "react"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) { return <SelectPrimitive.Root data-slot="select" {...props}/> }
function SelectGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>) { return <SelectPrimitive.Group data-slot="select-group" {...props}/> }
function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) { return <SelectPrimitive.Value data-slot="select-value" {...props}/> }
function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0", className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown className="size-4 opacity-60"/></SelectPrimitive.Icon></SelectPrimitive.Trigger>
}
function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content data-slot="select-content" position={position} className={cn("relative z-[10030] max-h-80 min-w-32 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1", className)} {...props}><SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1"><ChevronUp className="size-4"/></SelectPrimitive.ScrollUpButton><SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport><SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1"><ChevronDown className="size-4"/></SelectPrimitive.ScrollDownButton></SelectPrimitive.Content></SelectPrimitive.Portal>
}
function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) { return <SelectPrimitive.Label data-slot="select-label" className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props}/> }
function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn("relative flex min-h-8 w-full cursor-default select-none items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><span className="absolute right-2 flex size-3.5 items-center justify-center"><SelectPrimitive.ItemIndicator><Check className="size-4"/></SelectPrimitive.ItemIndicator></span></SelectPrimitive.Item>
}
function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) { return <SelectPrimitive.Separator data-slot="select-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props}/> }

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator }
