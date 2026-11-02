import { useTheme } from "next-themes";
import { Check, CircleDot, Moon, Monitor, Palette, Sun, WandSparkles } from "lucide-react";
import { SectionCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { stylePresets, useThemeStyle, welcomeTransitions } from "@/lib/theme-style";
export default function ThemeStyleSection(){
 const {theme,setTheme}=useTheme();
 const {preset,setPreset,transition,setTransition}=useThemeStyle();
 return <div className="space-y-4">
  <SectionCard title="Style & thèmes" description="Personnalisez les couleurs de toutes les fenêtres." className="max-w-3xl">
   <div className="space-y-5">
    <div><h3 className="mb-2 flex items-center gap-2 text-xs font-semibold"><Monitor className="size-4 text-primary"/>Mode d'affichage</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode d'affichage">
      {([{id:"system",label:"Système",icon:Monitor},{id:"light",label:"Clair",icon:Sun},{id:"dark",label:"Sombre",icon:Moon}] as const).map(mode=>
        <Button key={mode.id} type="button" size="sm" variant={theme===mode.id?"default":"outline"} aria-pressed={theme===mode.id} onClick={()=>setTheme(mode.id)}><mode.icon className="size-3.5"/>{mode.label}</Button>)}
      </div>
    </div>
    <div><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><Palette className="size-4 text-primary"/>Presets de couleurs</h3>
     <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
     {stylePresets.map(option=><button key={option.id} type="button" aria-pressed={preset===option.id} data-selected={preset===option.id} onClick={()=>setPreset(option.id)}
       className="hts-theme-choice flex min-h-20 items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[selected=true]:border-primary data-[selected=true]:bg-accent">
       <span className="flex size-12 shrink-0 overflow-hidden rounded-md border border-border/70" aria-hidden="true"><span className="w-1/2" style={{background:option.colors[0]}}/><span className="flex w-1/2 flex-col"><span className="h-1/2" style={{background:option.colors[1]}}/><span className="h-1/2" style={{background:option.colors[2]}}/></span></span>
       <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{option.label}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</span></span>
       {preset===option.id&&<Check className="size-4 shrink-0 text-primary" aria-hidden="true"/>}
      </button>)}
     </div>
    </div>
   </div>
  </SectionCard>
  <SectionCard title="Animations & transitions" description="Choisissez la façon dont l'accueil révèle l'application." className="max-w-3xl">
    <div className="space-y-2" role="group" aria-label="Transition d'ouverture">
      {welcomeTransitions.map(option=><button key={option.id} type="button" aria-pressed={transition===option.id} data-selected={transition===option.id} onClick={()=>setTransition(option.id)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[selected=true]:border-primary data-[selected=true]:bg-accent">
       <WandSparkles className="size-4 shrink-0 text-primary" aria-hidden="true"/><span className="flex-1"><span className="block text-xs font-semibold">{option.label}</span><span className="block text-[11px] text-muted-foreground">{option.description}</span></span>
       {transition===option.id?<Check className="size-4 text-primary" aria-hidden="true"/>:<CircleDot className="size-4 text-muted-foreground/60" aria-hidden="true"/>}
      </button>)}
      <p className="text-[11px] leading-relaxed text-muted-foreground">Sauvegarde automatique sur ce PC. Les animations respectent le réglage Windows « Réduire les mouvements ».</p>
    </div>
  </SectionCard>
 </div>;
}
