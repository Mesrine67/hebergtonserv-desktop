import { invoke, isTauri } from "@tauri-apps/api/core";

/** Record only constant event IDs; never send error messages, URLs or credentials. */
export function recordAppEvent(source: string, code: string): void {
  if (!isTauri()) return;
  void invoke("record_app_event", { source, code }).catch(() => undefined);
}

let installed = false;
export function installGlobalDiagnostics(): void {
  if (installed || !isTauri()) return;
  installed = true;
  recordAppEvent("lifecycle", "app_started");

  window.addEventListener("error", () => recordAppEvent("frontend", "unhandled_error"));
  window.addEventListener("unhandledrejection", () => recordAppEvent("frontend", "unhandled_rejection"));

  const previous = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    recordAppEvent("frontend", "console_error");
    previous(...args);
  };
}
