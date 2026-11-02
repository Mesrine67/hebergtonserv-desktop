import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TaskManagerWindow from "./pages/TaskManagerWindow";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "tasks" ? <TaskManagerWindow /> : <App />}
  </React.StrictMode>,
);
