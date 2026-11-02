import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Monitor, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { commands } from "@/lib/tauri";
import UpdaterSection from "@/components/UpdaterSection";
import ThemeStyleSection from "@/components/theme-style-section";

export default function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: commands.getSettings });
  const update = useMutation({
    mutationFn: async (vals: { closeToTray: boolean; startWithWindows: boolean }) => {
      const current = await commands.getSettings();
      if (current.data.start_with_windows !== vals.startWithWindows) {
        if (vals.startWithWindows) await commands.enableAutostart();
        else await commands.disableAutostart();
      }
      try { await commands.updateSettings(vals.closeToTray, vals.startWithWindows); }
      catch (error) {
        if (current.data.start_with_windows !== vals.startWithWindows) {
          try {
            if (current.data.start_with_windows) await commands.enableAutostart();
            else await commands.disableAutostart();
          } catch { toast.error("Impossible de restaurer le paramètre de démarrage Windows."); }
        }
        throw error;
      }
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("Paramètres enregistrés"); },
    onError: (e) => toast.error(String(e)),
  });
  const data = settings.data?.data;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Application" title="Paramètres" description="Personnalisez le comportement de la fenêtre, le démarrage Windows et les mises à jour de l'application." />
      <SectionCard title="Comportement Windows" description="Les réglages sont appliqués à votre session utilisateur." className="max-w-3xl">
        {settings.isPending ? <p className="text-sm text-muted-foreground">Chargement des paramètres…</p>
          : settings.isError ? <p role="alert" className="text-sm text-destructive">{String(settings.error)}</p>
          : data && <div className="divide-y divide-border">
              <label className="flex cursor-pointer items-center gap-4 py-4 first:pt-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><Bell className="size-5 text-primary" /></div>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Fermer dans la zone de notification</span>
                  <span className="mt-1 block text-xs text-muted-foreground">La croix masque la fenêtre sans quitter l'application lorsque ce paramètre est activé.</span>
                </span>
                <input className="size-4 shrink-0 accent-primary" type="checkbox" disabled={update.isPending} checked={data.close_to_tray}
                  onChange={(e) => update.mutate({ closeToTray: e.target.checked, startWithWindows: data.start_with_windows })} />
              </label>
              <label className="flex cursor-pointer items-center gap-4 py-4 last:pb-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><Monitor className="size-5 text-primary" /></div>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Démarrer avec Windows</span>
                  <span className="mt-1 block text-xs text-muted-foreground">L'application sera lancée automatiquement à l'ouverture de votre session.</span>
                </span>
                <input className="size-4 shrink-0 accent-primary" type="checkbox" disabled={update.isPending} checked={data.start_with_windows}
                  onChange={(e) => update.mutate({ closeToTray: data.close_to_tray, startWithWindows: e.target.checked })} />
              </label>
            </div>}
      </SectionCard>
      <ThemeStyleSection />
      <div className="max-w-3xl"><UpdaterSection /></div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Settings2 className="size-4" /> Les changements sont enregistrés automatiquement.</div>
    </div>
  );
}
