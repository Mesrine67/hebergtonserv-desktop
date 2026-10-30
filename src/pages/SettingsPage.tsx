import { useQuery, useMutation } from "@tanstack/react-query";
import { commands } from "../lib/tauri";
import { toast } from "sonner";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export default function SettingsPage() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: commands.getSettings });
  const update = useMutation({
    mutationFn: async (vals: { closeToTray: boolean; startWithWindows: boolean }) => {
      await commands.updateSettings(vals.closeToTray, vals.startWithWindows);
      if (vals.startWithWindows) {
        await commands.enableAutostart();
      } else {
        await commands.disableAutostart();
      }
    },
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
      <section className="space-y-2 border-t border-slate-700 pt-4">
        <h3 className="text-lg font-medium">Mises à jour</h3>
        <button
          className="bg-blue-600 px-4 py-2 rounded"
          onClick={async () => {
            try {
              const update = await check();
              if (update) {
                toast.info(`Mise à jour ${update.version} disponible`);
                await update.downloadAndInstall();
                await relaunch();
              } else {
                toast.success("Vous êtes à jour");
              }
            } catch (e) {
              toast.error(String(e));
            }
          }}
        >
          Vérifier les mises à jour
        </button>
      </section>
    </div>
  );
}
