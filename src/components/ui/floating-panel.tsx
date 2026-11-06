import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FloatingPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  descriptionId?: string;
  ariaDescribedBy?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
};

/** Shared non-modal panel: no backdrop, no background lock, and no page reflow. */
export function FloatingPanel({ open, onOpenChange, title, description, descriptionId, ariaDescribedBy, children, className, headerClassName }: FloatingPanelProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})} className={cn("flex w-[min(94vw,900px)] max-w-none flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-none", className)}>
      {title != null && <DialogHeader className={cn("shrink-0 border-b px-5 py-4 pr-14", headerClassName)}>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
      </DialogHeader>}
      {children}
    </DialogContent>
  </Dialog>;
}
