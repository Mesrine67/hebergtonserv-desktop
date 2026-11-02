import type { PanelConfig } from "@/lib/tauri";

/** An explicit panel id must never silently fall back to another account. */
export function resolvePanel(panels: PanelConfig[] | undefined, requestedId: string | null): PanelConfig | undefined {
  if (!panels?.length) return undefined;
  if (requestedId !== null) return panels.find((panel) => panel.id === requestedId);
  return panels.find((panel) => panel.status === "ok") ?? panels[0];
}

export function consoleRoute(panelId: string, serverIdentifier: string): string {
  return `/panel/servers/${encodeURIComponent(serverIdentifier)}?panel=${encodeURIComponent(panelId)}`;
}

export function serverListRoute(panelId: string | null): string {
  return panelId ? `/panel/servers?panel=${encodeURIComponent(panelId)}` : "/panel/servers";
}
