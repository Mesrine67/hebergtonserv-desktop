export type HtsNotification = {
  id: string;
  title: string;
  description: string;
  category: "system" | "update";
  createdAt: string;
  read: boolean;
};
export const NOTIFICATION_STORAGE_KEY = "hts-notifications-v1";
export const NOTIFICATION_EVENT = "hts:notification";
export const NOTIFICATION_CHANGED_EVENT = "hts:notifications-changed";
const LIMIT = 75;

export function readNotifications(): HtsNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HtsNotification =>
      item !== null && typeof item === "object" &&
      typeof item.id === "string" && typeof item.title === "string" &&
      typeof item.description === "string" &&
      (item.category === "system" || item.category === "update") &&
      typeof item.createdAt === "string" && typeof item.read === "boolean"
    ).slice(0, LIMIT);
  } catch { return []; }
}

export function writeNotifications(items: HtsNotification[]) {
  try { localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items.slice(0, LIMIT))); }
  catch { /* Storage unavailable; in-memory rendering still works. */ }
  window.dispatchEvent(new Event(NOTIFICATION_CHANGED_EVENT));
}

export function notifyDesktop(title: string, description: string, category: HtsNotification["category"] = "system") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: { title, description, category } }));
}
