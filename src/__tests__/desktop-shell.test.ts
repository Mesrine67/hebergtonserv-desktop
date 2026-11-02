// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readBrowserHistoryIndex } from "../lib/workspace-navigation";
import {
  NOTIFICATION_CHANGED_EVENT, NOTIFICATION_EVENT, NOTIFICATION_STORAGE_KEY,
  notifyDesktop, readNotifications, writeNotifications,
} from "../lib/notifications";

beforeEach(() => localStorage.clear());

describe("History controls", () => {
  it("accepts only valid React Router browser positions", () => {
    expect(readBrowserHistoryIndex({ idx: 2 })).toBe(2);
    expect(readBrowserHistoryIndex({ idx: 0 })).toBe(0);
    expect(readBrowserHistoryIndex({ idx: -1 })).toBe(0);
    expect(readBrowserHistoryIndex({ idx: "2" })).toBe(0);
    expect(readBrowserHistoryIndex({ idx: 1.5 })).toBe(0);
    expect(readBrowserHistoryIndex(null)).toBe(0);
  });
});

describe("Notification centre", () => {
  it("starts empty and tolerates malformed storage", () => {
    expect(readNotifications()).toEqual([]);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, "{bad");
    expect(readNotifications()).toEqual([]);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify([{ id: 5, title: "invalid" }]));
    expect(readNotifications()).toEqual([]);
  });
  it("persists read/unread notifications and emits a refresh event", () => {
    const event = vi.fn();
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, event);
    const entry = { id: "1", title: "Mise à jour", description: "0.4.10 disponible", category: "update" as const, createdAt: "2026-11-02T04:00:00Z", read: false };
    writeNotifications([entry]);
    expect(readNotifications()).toEqual([entry]);
    expect(event).toHaveBeenCalledTimes(1);
    writeNotifications([{ ...entry, read: true }]);
    expect(readNotifications()[0]?.read).toBe(true);
    writeNotifications([]);
    expect(readNotifications()).toEqual([]);
    window.removeEventListener(NOTIFICATION_CHANGED_EVENT, event);
  });
  it("publishes actual app events, not fictitious notifications", () => {
    const handler = vi.fn();
    window.addEventListener(NOTIFICATION_EVENT, handler);
    notifyDesktop("Test", "Notification locale", "system");
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0]?.[0] as CustomEvent).detail;
    expect(detail).toEqual({ title: "Test", description: "Notification locale", category: "system" });
    window.removeEventListener(NOTIFICATION_EVENT, handler);
    expect(readNotifications()).toEqual([]);
  });
});
