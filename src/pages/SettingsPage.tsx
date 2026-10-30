import { useQuery, useMutation } from "@tanstack/react-query";
import { commands } from "../lib/tauri";
import { toast } from "sonner";

export default function SettingsPage() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: commands.getSettings });
  const update = useMutation({
    mutationFn: (vals: { closeToTray: boolean; startWithWindows: boolean }) =>
      commands.updateSettings(vals.closeToTray, vals.startWithWindows),
    onSuccess: () => toast.success("Paramètres enregistrés"),
    onError: (e) => toast.error(String(e)),
  });

  const data = settings.data?.data;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-semibold">Paramètres</h2>
      {settings.isLoading && <p>Chargement…</p>}
      {data && (
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.close_to_tray}
              onChange={(e) =>
                update.mutate({ closeToTray: e.target.checked, startWithWindows: data.start_with_windows })
              }
            />
            Fermer vers la zone de notification
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.start_with_windows}
              onChange={(e) =>
                update.mutate({ closeToTray: data.close_to_tray, startWithWindows: e.target.checked })
              }
            />
            Démarrer avec Windows
          </label>
        </div>
      )}
    </div>
  );
}
