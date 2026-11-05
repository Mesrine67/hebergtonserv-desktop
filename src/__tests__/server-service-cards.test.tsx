// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getServiceKind } from "../lib/server-service-visuals";
import { ServerCard } from "../pages/PanelServersPage";
import type { PanelServer } from "../lib/tauri";

const sample = (egg?: string | null, status = "1", thumbnailUrl?: string): PanelServer => ({
  id: "12345678-1234-1234-1234-123456789012",
  identifier: "12345678",
  name: "Example Server",
  status,
  egg,
  thumbnail_url: thumbnailUrl,
  connect_address: "example.org:30120",
  node: "Game4",
  suspended: false,
  installing: false,
  limits: { memory: 1024, disk: 4096, cpu: 100 },
});

function renderCard(egg?: string | null, status = "1", thumbnailUrl?: string, dataUrl?: string) {
  const queryClient = new QueryClient();
  if (thumbnailUrl && dataUrl) {
    queryClient.setQueryData(["panel-egg-thumbnail", "demo", thumbnailUrl], dataUrl);
  }
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ServerCard
        server={sample(egg, status, thumbnailUrl)}
        panelId="demo"
        subuserIdentifier="12345678"
        onOpenConsole={() => {}}
        onOpenFiles={() => {}}
        onOpenDatabases={() => {}}
        loading={false}
        failed={false}
      />
    </QueryClientProvider>,
  );
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("Server egg visual mapping", () => {
  it.each([
    ["FiveM & RedM", "fivem"],
    ["FXServer", "fivem"],
    ["node.js generic", "node"],
    ["NodeJS 20", "node"],
    ["Minecraft Paper", "minecraft"],
    ["Fabric", "minecraft"],
    ["Discord Node.js Bot", "discord"],
    ["Python", "python"],
    ["MariaDB", "database"],
    ["Rust", "game"],
    ["unknown egg", "generic"],
  ] as const)("classifies %s as %s", (label, expected) => {
    expect(getServiceKind(label)).toBe(expected);
  });

  it("falls back for missing eggs without inferring from the server name", () => {
    expect(getServiceKind(null)).toBe("generic");
    expect(getServiceKind(undefined)).toBe("generic");
    expect(getServiceKind("  ")).toBe("generic");
  });
});

describe("Server card layout", () => {
  it("has exactly one actions icon, with service badge below status", () => {
    const dom = renderCard("FiveM & RedM");
    const header = dom.querySelector(".hts-server-card-header");
    const trigger = dom.querySelectorAll('[data-slot="dropdown-menu-trigger"]');
    const status = dom.querySelector('[data-testid="server-state-badge"]');
    const service = dom.querySelector('[data-testid="server-service-badge"]');

    expect(trigger).toHaveLength(1);
    expect(trigger[0].getAttribute("aria-label")).toContain("Actions du serveur Example Server");
    expect(dom.querySelector('button[aria-label*="Ouvrir la console"]')).toBeNull();
    expect(status?.textContent).toContain("En ligne");
    expect(service?.textContent).toContain("FiveM & RedM");
    expect(status?.parentElement).toBe(service?.parentElement);
    expect(status?.nextElementSibling).toBe(service);
    expect(dom.querySelector('[role="article"]')?.getAttribute("data-service-kind")).toBe("fivem");
    expect(header?.querySelector(".hts-server-card-art")).toBeNull();
    expect(dom.querySelectorAll(".hts-server-card-stat")).toHaveLength(4);
    expect(dom.querySelectorAll('[role="article"]')).toHaveLength(1);
  });

  it("renders a validated egg image from the React Query cache", () => {
    const url = "https://images.example.com/fivem.webp";
    const dom = renderCard("FiveM & RedM", "1", url, "data:image/webp;base64,AA==");
    const image = dom.querySelector<HTMLImageElement>(".hts-server-card-thumbnail");
    expect(image?.getAttribute("src")).toBe("data:image/webp;base64,AA==");
    expect(image?.getAttribute("alt")).toBe("");
    expect(dom.querySelectorAll('[role="article"]')).toHaveLength(1);
  });

  it("uses a neutral fallback when no thumbnail exists", () => {
    const dom = renderCard("FiveM & RedM");
    expect(dom.querySelector(".hts-server-card-thumbnail")).toBeNull();
    expect(dom.querySelector(".hts-server-card-art")).toBeNull();
  });

  it("renders a generic local icon when egg is missing and keeps offline state", () => {
    const dom = renderCard(null, "0");
    expect(dom.querySelector('[data-testid="server-service-badge"]')).toBeNull();
    expect(dom.querySelector('[data-service-kind="generic"]')).not.toBeNull();
    expect(dom.querySelector('[data-testid="server-state-badge"]')?.textContent).toContain("Arrêté");
  });
});
