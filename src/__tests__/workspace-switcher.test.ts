import { describe, expect, it } from "vitest";
import { workspaceForPath, workspaceMenuSide } from "../components/workspace-switcher";
import { sidebarSectionsForPath } from "../lib/workspace-sections";

describe("Workspace switcher routing", () => {
  it("selects the correct space based on the current route", () => {
    expect(workspaceForPath("/panel/servers")).toBe("infrastructure");
    expect(workspaceForPath("/panel/servers/abc/files")).toBe("infrastructure");
    expect(workspaceForPath("/panel/servers/abc/databases")).toBe("infrastructure");
    expect(workspaceForPath("/settings")).toBe("infrastructure");
    expect(workspaceForPath("/home")).toBe("infrastructure");
    expect(workspaceForPath("/ssh-keys")).toBe("ssh");
    expect(workspaceForPath("/ssh-config")).toBe("ssh");
    expect(workspaceForPath("/profiles")).toBe("ssh");
    expect(workspaceForPath("/git")).toBe("development");
    expect(workspaceForPath("/assistant")).toBe("development");
  });

  it("only lists navigation links owned by the active workspace", () => {
    const names = (path: string) => sidebarSectionsForPath(path).flatMap(section => section.items.map(entry => entry.title));
    expect(names("/panel/servers")).toEqual(["Panels", "Compte du panel", "Serveurs"]);
    expect(names("/panel/servers/abc/files")).toEqual(["Panels", "Compte du panel", "Serveurs"]);
    expect(names("/ssh-config")).toEqual(["Clés SSH", "Configuration", "Profils"]);
    expect(names("/profiles")).toEqual(["Clés SSH", "Configuration", "Profils"]);
    expect(names("/git")).toEqual(["Git / GH", "Assistant IA"]);
    expect(names("/assistant")).toEqual(["Git / GH", "Assistant IA"]);
    expect(names("/settings")).toEqual(["Panels", "Compte du panel", "Serveurs"]);
    expect(names("/home")).toEqual(["Panels", "Compte du panel", "Serveurs"]);
  });

  it("opens the workspace menu beside the sidebar on desktop and below on mobile", () => {
    expect(workspaceMenuSide(false)).toBe("right");
    expect(workspaceMenuSide(true)).toBe("bottom");
  });
});
