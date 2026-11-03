import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/error-message";

describe("errorMessage", () => {
  it("shows structured Tauri command messages", () => {
    expect(errorMessage({ code: "api_error", message: "Mise à jour WISP en cours" })).toBe("Mise à jour WISP en cours");
  });

  it("extracts useful details from API error arrays", () => {
    expect(errorMessage({ errors: [{ detail: "Panel en maintenance" }, { message: "Réessayez plus tard" }] }))
      .toBe("Panel en maintenance · Réessayez plus tard");
  });

  it("handles network errors and strings", () => {
    expect(errorMessage(new Error("Connexion refusée"))).toBe("Connexion refusée");
    expect(errorMessage("Erreur réseau")).toBe("Erreur réseau");
  });

  it("never stringifies arbitrary objects as [object Object]", () => {
    expect(errorMessage({ status: 503 })).toContain("La connexion a échoué");
    expect(errorMessage({})).not.toContain("[object Object]");
  });
});
