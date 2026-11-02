// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeStyleProvider, useThemeStyle } from "../lib/theme-style";

function Harness() {
  const { preset, setPreset, transition, setTransition } = useThemeStyle();
  return <div>
    <span data-testid="preset">{preset}</span>
    <span data-testid="transition">{transition}</span>
    <button onClick={() => setPreset("jade")}>Jade</button>
    <button onClick={() => setTransition("halo")}>Halo</button>
  </div>;
}

describe("Persisted Mira style and welcome transition", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete document.documentElement.dataset.htsPreset;
    delete document.documentElement.dataset.htsTransition;
  });

  it("sets semantic theme attributes and persists both choices", async () => {
    await act(async () => root.render(<ThemeStyleProvider><Harness /></ThemeStyleProvider>));
    expect(document.documentElement.dataset.htsPreset).toBe("mira");
    expect(document.documentElement.dataset.htsTransition).toBe("float");
    await act(async () => container.querySelectorAll("button")[0]?.click());
    await act(async () => container.querySelectorAll("button")[1]?.click());
    expect(document.documentElement.dataset.htsPreset).toBe("jade");
    expect(document.documentElement.dataset.htsTransition).toBe("halo");
    expect(window.localStorage.getItem("hts-style-preset")).toBe("jade");
    expect(window.localStorage.getItem("hts-welcome-transition")).toBe("halo");
  });

  it("ignores invalid saved values", async () => {
    window.localStorage.setItem("hts-style-preset", "unknown");
    window.localStorage.setItem("hts-welcome-transition", "unknown");
    await act(async () => root.render(<ThemeStyleProvider><Harness /></ThemeStyleProvider>));
    expect(container.querySelector('[data-testid="preset"]')?.textContent).toBe("mira");
    expect(container.querySelector('[data-testid="transition"]')?.textContent).toBe("float");
  });

  it("restores an existing valid preset and transition", async () => {
    window.localStorage.setItem("hts-style-preset", "plum");
    window.localStorage.setItem("hts-welcome-transition", "curtain");
    await act(async () => root.render(<ThemeStyleProvider><Harness /></ThemeStyleProvider>));
    expect(document.documentElement.dataset.htsPreset).toBe("plum");
    expect(document.documentElement.dataset.htsTransition).toBe("curtain");
  });
});
