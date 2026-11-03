import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TaskManagerWindow from "./pages/TaskManagerWindow";
import { installGlobalDiagnostics } from "@/lib/app-diagnostics";

installGlobalDiagnostics();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "tasks" ? <TaskManagerWindow /> : <App />}
  </React.StrictMode>,
);
