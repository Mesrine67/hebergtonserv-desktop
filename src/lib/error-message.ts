/** Tauri commands reject with a serialized { code, message } object. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown };
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (typeof value.code === "string" && value.code.trim()) return `Erreur (${value.code})`;
  }
  return "La connexion a échoué. Vérifiez l’adresse du panel et votre jeton API.";
}
