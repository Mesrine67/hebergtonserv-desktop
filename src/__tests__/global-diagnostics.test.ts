import { describe, expect, it } from "vitest";
import { formatAiDiagnosticEntries, formatDiagnosticEntries, type DiagnosticEntry } from "../components/panel-diagnostics";

const entries: DiagnosticEntry[] = [
  { timestamp: "2026-11-03T01:00:00Z", level: "warning", operation: "wisp_resources", code: "api_validation_error", message: "Requête API échouée" },
  { timestamp: "2026-11-03T01:00:01Z", level: "info", operation: "lifecycle", code: "app_started", message: "Interface démarrée" },
];

describe("global diagnostic export", () => {
  it("exports API and lifecycle events under a global heading", () => {
    const report = formatDiagnosticEntries(entries);
    expect(report).toContain("Journal global de l’application");
    expect(report).toContain("wisp_resources");
    expect(report).toContain("lifecycle");
    expect(report).toContain("HTTP 400/422");
  });
  it("exports structured safe context for ChatGPT and Codex", () => {
    for (const target of ["chatgpt", "codex"] as const) {
      const report = formatAiDiagnosticEntries(entries, target);
      expect(report).toContain("HébergTonServ Desktop");
      expect(report).toContain("Entrées : 2, avertissements et erreurs : 1");
      expect(report).toContain("wisp_resources / api_validation_error");
      expect(report).toContain("Données personnelles, en-têtes, jetons, URL et réponses API non inclus");
    }
  });
});
