// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getServiceKind } from "../lib/server-service-visuals";
import { ServerCard } from "../pages/PanelServersPage";
import type { PanelServer } from "../lib/tauri";

const sample = (egg?: string | null, status = "1"): PanelServer => ({
  id: "12345678-1234-1234-1234-123456789012",
  identifier: "12345678",
  name: "Example Server",
  status,
  egg,
  connect_address: "example.org:30120",
  node: "Game4",
  suspended: false,
  installing: false,
  limits: { memory: 1024, disk: 4096, cpu: 100 },
});

function renderCard(egg?: string | null, status = "1") {
  const queryClient = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ServerCard
        server={sample(egg, status)}
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
    expect(header?.getAttribute("data-service-kind")).toBe("fivem");
    expect(header?.querySelector('[aria-hidden="true"].hts-server-card-art svg')).not.toBeNull();
    expect(dom.querySelectorAll('[role="article"]')).toHaveLength(1);
  });

  it("renders a generic local icon when egg is missing and keeps offline state", () => {
    const dom = renderCard(null, "0");
    expect(dom.querySelector('[data-testid="server-service-badge"]')).toBeNull();
    expect(dom.querySelector('[data-service-kind="generic"]')).not.toBeNull();
    expect(dom.querySelector('[data-testid="server-state-badge"]')?.textContent).toContain("Arrêté");
  });
});
