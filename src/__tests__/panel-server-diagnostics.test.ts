// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { stateFor } from "../pages/PanelServersPage";
import { formatDiagnosticEntries } from "../components/panel-diagnostics";
import type { PanelServer } from "../lib/tauri";

function server(status: string | null = null): PanelServer {
  return {id:"example-uuid",identifier:"example",name:"Example",status,node:null,
    connect_address:null,suspended:false,installing:false,limits:{}};
}
describe("Server state recognition",()=>{
  it("recognizes legacy WISP and Pterodactyl status values",()=>{
    expect(stateFor(server("1"))).toBe("online");
    expect(stateFor(server("0"))).toBe("offline");
    expect(stateFor(server(), {state:"running",suspended:false})).toBe("online");
    expect(stateFor(server(), {state:"starting",suspended:false})).toBe("starting");
  });
  it("keeps unknown status distinct from stopped and respects suspension",()=>{
    expect(stateFor(server())).toBe("unknown");
    expect(stateFor(server("unexpected"))).toBe("unknown");
    expect(stateFor({...server("1"),suspended:true})).toBe("suspended");
  });
});
describe("Sanitized API diagnostic text",()=>{
  it("renders bounded structured event entries without adding payloads",()=>{
    const text=formatDiagnosticEntries([{event_id:1,schema_version:1,timestamp:"2026-11-02T10:00:00Z",level:"warning",operation:"panel_resources",code:"api_rate_limit",message:"Ressources indisponibles"}]);
    expect(text).toContain("api_rate_limit");
    expect(text).toContain("Ressources indisponibles");
    expect(text).not.toContain("Authorization");
  });
});
