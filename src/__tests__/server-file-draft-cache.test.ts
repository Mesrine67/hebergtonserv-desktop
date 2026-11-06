import { afterEach, describe, expect, it } from "vitest";
import { clearServerFileDraft, getServerExplorerState, getServerFileDraft, setServerExplorerState, setServerFileDraft } from "@/lib/server-file-draft-cache";

describe("server file editor session cache", () => {
  afterEach(() => clearServerFileDraft("panel-a", "server-a", "/config.json"));

  it("keeps unsaved content and the selected file across explorer remounts", () => {
    setServerFileDraft("panel-a", "server-a", "/config.json", "{\"changed\":true}");
    setServerExplorerState("panel-a", "server-a", { selected: "/config.json", path: "/" });

    expect(getServerFileDraft("panel-a", "server-a", "/config.json")).toBe("{\"changed\":true}");
    expect(getServerExplorerState("panel-a", "server-a")).toEqual({ selected: "/config.json", path: "/" });
  });

  it("clears the cached draft after save or revert", () => {
    setServerFileDraft("panel-a", "server-a", "/config.json", "unsaved");
    clearServerFileDraft("panel-a", "server-a", "/config.json");

    expect(getServerFileDraft("panel-a", "server-a", "/config.json")).toBeUndefined();
  });

  it("isolates the same file path by panel and server", () => {
    setServerFileDraft("panel-a", "server-a", "/config.json", "one");
    setServerFileDraft("panel-b", "server-b", "/config.json", "two");

    expect(getServerFileDraft("panel-a", "server-a", "/config.json")).toBe("one");
    expect(getServerFileDraft("panel-b", "server-b", "/config.json")).toBe("two");
    clearServerFileDraft("panel-b", "server-b", "/config.json");
  });
});
