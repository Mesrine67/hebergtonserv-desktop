import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import SshKeysPage from "./pages/SshKeysPage";
import SshConfigPage from "./pages/SshConfigPage";
import PanelsPage from "./pages/PanelsPage";
import ProfilesPage from "./pages/ProfilesPage";
import SettingsPage from "./pages/SettingsPage";
import SecurityPage from "./pages/SecurityPage";
import "./App.css";

const queryClient = new QueryClient();

const nav = [
  { to: "/ssh-keys", label: "Clés SSH" },
  { to: "/ssh-config", label: "Config SSH" },
  { to: "/profiles", label: "Profils SSH" },
  { to: "/panels", label: "Panels" },
  { to: "/settings", label: "Paramètres" },
  { to: "/security", label: "Sécurité" },
];

function Layout() {
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 p-4 flex flex-col gap-2">
        <h1 className="text-lg font-bold mb-4">HébergTonServ Desktop</h1>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<SshKeysPage />} />
          <Route path="/ssh-keys" element={<SshKeysPage />} />
          <Route path="/ssh-config" element={<SshConfigPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/panels" element={<PanelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/security" element={<SecurityPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
