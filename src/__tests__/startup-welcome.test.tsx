// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartupWelcome from "../components/startup-welcome";

describe("Startup Hello Effect", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("shows handwriting, and skipping reveals Démarrer without entering the dashboard", async () => {
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    expect(container.querySelector('[data-testid="hello-writing"]')).not.toBeNull();
    expect(container.querySelector(".hts-brand-writing-text")?.textContent).toBe("HébergTonServ");
    const skip = container.querySelector<HTMLButtonElement>(".hts-welcome-skip");
    expect(skip?.textContent).toContain("Passer");
    await act(async () => skip?.click());
    expect(dismiss).not.toHaveBeenCalled();
    const start = container.querySelector<HTMLButtonElement>(".hts-welcome-start");
    expect(start?.textContent).toContain("Démarrer");
    expect(document.activeElement).toBe(start);
    await act(async () => start?.click());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("reveals Démarrer rather than automatically dismissing when animation ends", async () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    expect(container.querySelector(".hts-welcome-start")).toBeNull();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(container.querySelector(".hts-welcome-start")).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(dismiss).not.toHaveBeenCalled();
    const start = container.querySelector<HTMLButtonElement>(".hts-welcome-start");
    await act(async () => start?.click());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("offers the start button immediately with reduced-motion preference", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    expect(container.querySelector(".hts-welcome-start")).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("Escape skips the drawing but never opens the dashboard", async () => {
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector(".hts-welcome-start")).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
