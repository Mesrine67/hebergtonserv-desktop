import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../lib/tauri";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: commands.getSettings });
  const update = useMutation({
    mutationFn: async (vals: { closeToTray: boolean; startWithWindows: boolean }) => {
      const current = await commands.getSettings();
      if (current.data.start_with_windows !== vals.startWithWindows) {
        // Apply the OS change first, so a failed autostart operation does not
        // leave an incorrect "enabled" value in the application settings.
        if (vals.startWithWindows) {
          await commands.enableAutostart();
        } else {
          await commands.disableAutostart();
        }
      }
      try {
        await commands.updateSettings(vals.closeToTray, vals.startWithWindows);
      } catch (error) {
        // Restore the previous OS state when persisting the setting fails.
        if (current.data.start_with_windows !== vals.startWithWindows) {
          try {
            if (current.data.start_with_windows) {
              await commands.enableAutostart();
            } else {
              await commands.disableAutostart();
            }
          } catch {
            toast.error("Impossible de restaurer l'ancien démarrage Windows.");
          }
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Paramètres enregistrés");
    },
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
              disabled={update.isPending}
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
              disabled={update.isPending}
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
