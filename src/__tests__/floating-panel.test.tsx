// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { DesktopHelpPanels } from "@/components/desktop-help-panels";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

function PanelProbe() {
  const [open, setOpen] = useState(false);
  const [clicks, setClicks] = useState(0);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open panel</button>
    <button type="button" onClick={() => setClicks(value => value + 1)}>Underlying action {clicks}</button>
    <FloatingPanel open={open} onOpenChange={setOpen} title="Probe" description="Panel test">
      <p>Panel body</p>
    </FloatingPanel>
  </>;
}

describe("floating panels", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    host = null;
    root = null;
    vi.restoreAllMocks();
  });

  async function render(node: ReactNode) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root?.render(node));
  }

  it("keeps the page usable and can be opened again after closing", async () => {
    await render(<PanelProbe />);
    const underlay = document.querySelector<HTMLButtonElement>("button:nth-of-type(2)")!;
    const openButton = document.querySelector<HTMLButtonElement>("button:nth-of-type(1)")!;
    await act(async () => openButton.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      underlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
      underlay.click();
    });
    expect(underlay.textContent).toContain("1");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    const close = document.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!;
    await act(async () => close.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => openButton.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("opens the changelog from its shared floating-panel host every time", async () => {
    await render(<DesktopHelpPanels />);
    await act(async () => window.dispatchEvent(new Event("hts:open-changelog")));
    expect(document.body.textContent).toContain("Nouveautés et changelog");
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!;
    await act(async () => close.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => window.dispatchEvent(new Event("hts:open-changelog")));
    expect(document.body.textContent).toContain("Nouveautés et changelog");
  });
});
