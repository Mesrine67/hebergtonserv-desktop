import { useEffect, useMemo, useState } from "react";
import { Bell, BellDot, CheckCheck, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  NOTIFICATION_CHANGED_EVENT, NOTIFICATION_EVENT, readNotifications, writeNotifications,
  type HtsNotification,
} from "@/lib/notifications";

export function NotificationsAction() {
  const [items, setItems] = useState<HtsNotification[]>(readNotifications);
  const [open, setOpen] = useState(false);
  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<Pick<HtsNotification, "title" | "description" | "category">>).detail;
      if (!detail || typeof detail.title !== "string" || typeof detail.description !== "string") return;
      const item: HtsNotification = {
        id: crypto.randomUUID(), title: detail.title.slice(0, 120),
        description: detail.description.slice(0, 1200),
        category: detail.category === "update" ? "update" : "system",
        createdAt: new Date().toISOString(), read: false,
      };
      const next = [item, ...readNotifications()].slice(0, 75);
      setItems(next);
      writeNotifications(next);
    };
    const sync = () => setItems(readNotifications());
    window.addEventListener(NOTIFICATION_EVENT, receive);
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, receive);
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function save(next: HtsNotification[]) {
    setItems(next);
    writeNotifications(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm"
              className="relative size-8" aria-label={unread ? `Notifications, ${unread} non lues` : "Centre de notifications"}
              aria-expanded={open}>
              {unread ? <BellDot className="size-4" /> : <Bell className="size-4" />}
              {unread > 0 && <span className="absolute right-0 top-0 size-1.5 rounded-full bg-primary" aria-hidden="true" />}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="z-[10010] w-[min(390px,calc(100vw-20px))] overflow-hidden rounded-xl border bg-popover p-0 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-[11px] text-muted-foreground">{unread ? `${unread} non lue(s)` : "Tout est à jour"}</p>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Tout marquer comme lu"
              title="Tout marquer comme lu" disabled={unread === 0}
              onClick={() => save(items.map((item) => ({ ...item, read: true })))}>
              <CheckCheck className="size-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Effacer les notifications"
              title="Effacer les notifications" disabled={items.length === 0} onClick={() => save([])}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[min(430px,60vh)] overflow-y-auto p-2" aria-live="polite">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <Inbox className="size-7" />
              <p className="text-sm font-medium">Aucune notification</p>
              <p className="text-xs">Les événements de l'application apparaîtront ici.</p>
            </div>
          ) : items.map((item) => (
            <button key={item.id} type="button"
              className={`flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/50 ${item.read ? "opacity-65" : "bg-primary/5"}`}
              aria-label={`${item.title}, ${item.read ? "lue" : "non lue"}`}
              onClick={() => save(items.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))}>
              <span className={`mt-1 size-1.5 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{item.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString("fr-FR")}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">Historique local sur cet appareil uniquement.</p>
      </PopoverContent>
    </Popover>
  );
}
