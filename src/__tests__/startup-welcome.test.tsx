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
  });

  it("shows the hello handwriting and can be skipped", async () => {
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    expect(container.querySelector('[data-testid="hello-writing"]')).not.toBeNull();
    expect(container.querySelectorAll("svg path")).toHaveLength(5);
    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Passer");
    await act(async () => button?.click());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("uses a timeout fallback if CSS animation events are unavailable", async () => {
    vi.useFakeTimers();
    try {
      const dismiss = vi.fn();
      await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
      expect(dismiss).not.toHaveBeenCalled();
      await act(async () => { vi.advanceTimersByTime(4000); });
      expect(dismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("completes immediately when reduced motion is requested", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const dismiss = vi.fn();
    await act(async () => root.render(<StartupWelcome onDismiss={dismiss} />));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
