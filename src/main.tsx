import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/monaco-workers";
import App from "./App";
import TaskManagerWindow from "./pages/TaskManagerWindow";
import { installGlobalDiagnostics } from "@/lib/app-diagnostics";
import { isTauri } from "@tauri-apps/api/core";

installGlobalDiagnostics();

function StartupSplash() {
  return (
    <main style={{
      width: "100vw", height: "100vh", display: "grid", placeItems: "center",
      overflow: "hidden", color: "#f8fafc", background: "#0b1220",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    }}>
      <section style={{ width: 310, display: "grid", justifyItems: "center", gap: 12, textAlign: "center", padding: "22px 18px", border: "1px solid #26364d", borderRadius: 14, background: "#111a29", boxShadow: "0 16px 42px #03071266" }}>
        <div aria-hidden="true" style={{
          width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 14,
          border: "1px solid #294267", background: "linear-gradient(145deg, #1b3558, #101d31)",
          color: "#8ec5ff", fontSize: 24, fontWeight: 750, boxShadow: "0 12px 38px #03071288",
        }}>H</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 650, letterSpacing: "-.025em" }}>HébergTonServ</h1>
          <p style={{ margin: "5px 0 0", color: "#9aa9bd", fontSize: 12 }}>Préparation de votre espace</p>
        </div>
        <div aria-label="Chargement" role="status" style={{ display: "flex", gap: 5, marginTop: 4 }}>
          {[0, 1, 2].map((dot) => <span key={dot} style={{
            width: 5, height: 5, borderRadius: "50%", background: "#60a5fa", opacity: .45 + dot * .18,
          }} />)}
        </div>
      </section>
    </main>
  );
}

function StartupGate() {
  const [ready, setReady] = React.useState(!isTauri());
  React.useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(timer);
  }, [ready]);
  return ready ? <App /> : <StartupSplash />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "tasks" ? <TaskManagerWindow /> : <StartupGate />}
  </React.StrictMode>,
);
