import { describe, expect, it } from "vitest";
import { consoleRoute, resolvePanel, serverListRoute, serverSectionRoute } from "@/lib/panel-navigation";
import type { PanelConfig } from "@/lib/tauri";

const panels = [
  { id: "wisp-one", name: "WISP", status: "ok" },
  { id: "ptero-two", name: "Pterodactyl", status: "ok" },
] as PanelConfig[];

describe("panel console routing", () => {
  it("keeps the exact panel selected for console operations", () => {
    expect(resolvePanel(panels, "ptero-two")?.id).toBe("ptero-two");
    expect(resolvePanel(panels, "wisp-one")?.id).toBe("wisp-one");
  });

  it("refuses to silently fall back to another account for an invalid explicit panel", () => {
    expect(resolvePanel(panels, "not-present")).toBeUndefined();
    expect(resolvePanel(panels, null)?.id).toBe("wisp-one");
  });

  it("encodes server and account identifiers in URLs", () => {
    expect(consoleRoute("a & b", "server/special")).toBe("/panel/servers/server%2Fspecial?panel=a%20%26%20b");
    expect(serverListRoute("a & b")).toBe("/panel/servers?panel=a%20%26%20b");
  });

  it("keeps console, files, and databases scoped to the selected panel and server", () => {
    expect(serverSectionRoute("ptero-two", "server-abc", "files")).toBe("/panel/servers/server-abc/files?panel=ptero-two");
    expect(serverSectionRoute("ptero-two", "server-abc", "databases")).toBe("/panel/servers/server-abc/databases?panel=ptero-two");
    expect(serverSectionRoute("ptero-two", "server-abc", "console")).toBe(consoleRoute("ptero-two", "server-abc"));
  });
});
