import { describe, expect, it } from "vitest";
import { workspaceForPath } from "../components/workspace-switcher";

describe("Workspace switcher routing", () => {
  it("selects the correct space based on the current route", () => {
    expect(workspaceForPath("/panel/servers")).toBe("infrastructure");
    expect(workspaceForPath("/panel/servers/abc/files")).toBe("infrastructure");
    expect(workspaceForPath("/settings")).toBe("infrastructure");
    expect(workspaceForPath("/home")).toBe("infrastructure");
    expect(workspaceForPath("/ssh-keys")).toBe("ssh");
    expect(workspaceForPath("/ssh-config")).toBe("ssh");
    expect(workspaceForPath("/profiles")).toBe("ssh");
    expect(workspaceForPath("/git")).toBe("development");
  });
});
