(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelFileTree } from "../components/panel-file-tree";

const listFiles = vi.hoisted(() => vi.fn());
vi.mock("../lib/tauri", () => ({ commands: { listPanelServerFiles: listFiles } }));

describe("Panel file tree", () => {
  let root: Root | null = null;
  let host: HTMLElement | null = null;
  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    listFiles.mockReset();
  });

  it("can transition from loading to a populated directory without changing hook order", async () => {
    let resolveFiles!: (files: unknown[]) => void;
    const response = new Promise<unknown[]>(resolve => { resolveFiles = resolve; });
    listFiles.mockReturnValue(response);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const selectFile = vi.fn();
    await act(async () => {
      root?.render(
        <QueryClientProvider client={client}>
          <PanelFileTree panelId="panel-1" serverId="server-a" path="/" selected={null}
            filter="" showHidden onSelect={selectFile} />
        </QueryClientProvider>,
      );
    });
    expect(host.textContent).toContain("Chargement");
    await act(async () => {
      resolveFiles([{ name: "server.cfg", kind: "file", path: "/server.cfg" }]);
      await response;
    });
    await vi.waitFor(() => {
      expect(host?.querySelector('[role="treeitem"]')?.textContent).toContain("server.cfg");
    }, { timeout: 5_000 });
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
