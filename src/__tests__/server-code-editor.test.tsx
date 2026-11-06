(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerCodeEditor, serverFileLanguage } from "../components/server-code-editor";

describe("Server code editor", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it("detects common configuration languages", () => {
    expect(serverFileLanguage("/resources/server.cfg")).toBe("Config");
    expect(serverFileLanguage("/config/settings.json")).toBe("JSON");
    expect(serverFileLanguage("/my-project/manifest.lua")).toBe("Lua");
    expect(serverFileLanguage("/txData/admins.JSON")).toBe("JSON");
    expect(serverFileLanguage("/server/.env.production")).toBe("Config");
    expect(serverFileLanguage("/server/Dockerfile")).toBe("Dockerfile");
    expect(serverFileLanguage("/server/main.rs")).toBe("Rust");
    expect(serverFileLanguage("/server/unknown.bin")).toBe("Texte brut");
    expect(serverFileLanguage("/readme.unknown")).toBe("Texte brut");
  });

  it("saves only on a user's explicit action and indicates unsaved changes", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const onSave = vi.fn();
    const onChange = vi.fn();
    await act(async () => root?.render(<ServerCodeEditor path="/server.cfg" value="test=2"
      original="test=1" onChange={onChange} onSave={onSave} saving={false} onRefresh={vi.fn()} refreshing={false}/>));
    expect(host.textContent).toContain("Modifié");
    expect(host.querySelector(".hts-code-property")).not.toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    const saveButton = [...host.querySelectorAll("button")].find(node => node.textContent?.includes("Enregistrer"));
    expect(saveButton).not.toBeUndefined();
    await act(async () => saveButton?.click());
    expect(onSave).toHaveBeenCalledTimes(1);
    const input = host.querySelector("textarea");
    expect(input?.value).toBe("test=2");
    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
