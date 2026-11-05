(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppUpdaterProvider, useAppUpdater, UPDATE_STARTUP_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from "../lib/app-updater";

const mocks = vi.hoisted(() => ({
  check: vi.fn(), notify: vi.fn(),
  version: vi.fn().mockResolvedValue("0.4.29"),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: mocks.version }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("../lib/notifications", () => ({ notifyDesktop: mocks.notify }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

function Probe() {
  const updater = useAppUpdater();
  return <div><span data-testid="status">{updater.status}</span>
    <span data-testid="new-version">{updater.availableVersion}</span>
    <button type="button" onClick={() => void updater.checkForUpdates(false)}>Vérifier</button>
    <button type="button" onClick={() => void updater.installUpdate()}>Installer</button>
  </div>;
}

describe("Automatic updater", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("checks automatically, shows availability and never installs until confirmed", async () => {
    vi.useFakeTimers();
    const update = {
      version: "0.4.30", body: "Nouveautés", close: vi.fn().mockResolvedValue(undefined),
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    };
    mocks.check.mockResolvedValue(update);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root?.render(<AppUpdaterProvider><Probe /></AppUpdaterProvider>));
    expect(mocks.check).toHaveBeenCalledTimes(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_STARTUP_DELAY_MS);
    });
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="new-version"]')?.textContent).toBe("0.4.30");
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS); });
    expect(mocks.check).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    await act(async () => host?.querySelectorAll("button")[1]?.click());
    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
  });
});
