/** Tauri commands reject with a serialized { code, message } object. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; error?: unknown; errors?: unknown };
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (Array.isArray(value.errors)) {
      const details = value.errors.map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const detail = item as { detail?: unknown; message?: unknown; title?: unknown };
        for (const candidate of [detail.detail, detail.message, detail.title]) {
          if (typeof candidate === "string" && candidate.trim()) return candidate;
        }
        return "";
      }).filter(Boolean);
      if (details.length) return details.join(" · ");
    }
    if (typeof value.error === "string" && value.error.trim()) return value.error;
    if (typeof value.code === "string" && value.code.trim()) return `Erreur (${value.code})`;
    // Avoid leaking implementation details while never rendering "[object Object]".
  }
  return "La connexion a échoué. Vérifiez l’adresse du panel et votre jeton API.";
}
