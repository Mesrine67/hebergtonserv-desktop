// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StartupWelcome from "../components/startup-welcome";

describe("HébergTonServ handwritten welcome effect", () => {
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

  it("renders actual SVG strokes spelling the brand, not opacity-animated HTML letters", async () => {
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    const svg = container.querySelector<SVGSVGElement>('[data-slot="hello-effect"]');
    expect(svg?.getAttribute("aria-label")).toBe("HébergTonServ");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(15);
    expect(svg?.querySelector('path[data-accent="true"]')).not.toBeNull();
    expect(svg?.querySelector('path[data-last="true"]')).not.toBeNull();
    expect(container.querySelector(".hts-welcome-start")).toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("skips drawing but does not enter until Démarrer is explicitly clicked", async () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    const enter = vi.fn();
    await act(async () => root.render(<StartupWelcome onEnter={enter} onDismiss={dismiss} />));
    const skip = container.querySelector<HTMLButtonElement>(".hts-welcome-skip");
    expect(skip?.textContent).toContain("Passer");
    expect(document.activeElement).toBe(skip);
    await act(async () => skip?.click());
    expect(dismiss).not.toHaveBeenCalled();
    const start = container.querySelector<HTMLButtonElement>(".hts-welcome-start");
    expect(start?.textContent).toContain("Démarrer");
    expect(document.activeElement).toBe(start);
    await act(async () => start?.click());
    expect(container.querySelector(".hts-welcome-screen")?.getAttribute("data-leaving")).toBe("true");
    expect(enter).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(730); });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("marks the final SVG stroke and schedules it after the earlier strokes", async () => {
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    const paths = Array.from(container.querySelectorAll<SVGPathElement>('[data-slot="hello-effect"] path'));
    const first = paths[0];
    const last = paths[paths.length - 1];
    expect(last.getAttribute("data-last")).toBe("true");
    expect(first.style.getPropertyValue("--hello-stroke-delay")).toBe("0ms");
    const finalDelay = Number.parseFloat(last.style.getPropertyValue("--hello-stroke-delay"));
    expect(finalDelay).toBeGreaterThan(2500);
    expect(container.querySelector(".hts-welcome-start")).toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("provides a fallback when WebView2 does not emit animationend", async () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    await act(async () => { vi.advanceTimersByTime(3900); });
    expect(container.querySelector(".hts-welcome-start")).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("renders the complete strokes and start button immediately with reduced motion", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    const start = container.querySelector<HTMLButtonElement>(".hts-welcome-start");
    expect(start).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => start?.click());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("Escape skips drawing without skipping the confirmation button", async () => {
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector(".hts-welcome-start")).not.toBeNull();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
