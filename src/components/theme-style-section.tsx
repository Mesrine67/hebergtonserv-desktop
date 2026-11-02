import { useTheme } from "next-themes";
import { Check, CircleDot, Monitor, Moon, Palette, RotateCcw, Sun, WandSparkles } from "lucide-react";
import { SectionCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { accentThemes, baseColors, stylePresets, useThemeStyle, visualStyles, welcomeTransitions } from "@/lib/theme-style";

export default function ThemeStyleSection() {
 const {theme,setTheme}=useTheme();
 const {preset,setPreset,visualStyle,setVisualStyle,baseColor,setBaseColor,accentTheme,setAccentTheme,transition,setTransition}=useThemeStyle();
 function reset(){setTheme("system");setPreset("mira");setVisualStyle("mira");setBaseColor("neutral");setAccentTheme("original");setTransition("float");}
 return <div className="space-y-4">
  <SectionCard title="Style & thèmes" description="Combinez mode d'affichage, style visuel, couleur de base et accents." className="max-w-3xl">
   <div className="space-y-6">
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold"><Monitor className="size-4 text-primary"/>Mode d'affichage</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode d'affichage">
      {([{id:"system",label:"Système",icon:Monitor},{id:"light",label:"Clair",icon:Sun},{id:"dark",label:"Sombre",icon:Moon}] as const).map(mode=>
        <Button key={mode.id} type="button" size="sm" variant={theme===mode.id?"default":"outline"} aria-pressed={theme===mode.id} onClick={()=>setTheme(mode.id)}><mode.icon className="size-3.5"/>{mode.label}</Button>)}
      </div>
    </div>
    <div>
      <h3 className="mb-2 text-xs font-semibold">Style visuel shadcn</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">Adaptations dynamiques du rayon, de la densité et des contours. Elles conservent les composants Radix actuels.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visualStyles.map(item=><button key={item.id} type="button" aria-pressed={visualStyle===item.id}
          onClick={()=>setVisualStyle(item.id)}
          className="flex min-h-20 items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/55 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent/50">
          <span><span className="block text-xs font-semibold">{item.label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.description}</span></span>
          {visualStyle===item.id&&<Check className="size-4 shrink-0 text-primary"/>}
        </button>)}
      </div>
    </div>
    <div>
     <h3 className="mb-2 text-xs font-semibold">Couleur de base</h3>
     <div className="flex flex-wrap gap-2" role="group" aria-label="Couleur de base">
      {baseColors.map(item=><Button key={item.id} type="button" variant={baseColor===item.id?"secondary":"outline"} size="sm" aria-pressed={baseColor===item.id}
       className={baseColor===item.id?"border-primary/70":""} onClick={()=>setBaseColor(item.id)}>{item.label}</Button>)}
     </div>
    </div>
    <div>
     <h3 className="mb-2 text-xs font-semibold">Thème d'accentuation</h3>
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Thème d'accentuation">
      {accentThemes.map(item=><button key={item.id} type="button" aria-pressed={accentTheme===item.id} onClick={()=>setAccentTheme(item.id)}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/55 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary">
        <span className="size-3.5 shrink-0 rounded-full border border-foreground/10" style={{background:item.swatch}} aria-hidden="true"/>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>{accentTheme===item.id&&<Check className="size-3.5 shrink-0 text-primary"/>}
      </button>)}
     </div>
    </div>
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><Palette className="size-4 text-primary"/>Palettes de l'application</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
       {stylePresets.map(option=><button key={option.id} type="button" aria-pressed={preset===option.id} data-selected={preset===option.id} onClick={()=>setPreset(option.id)}
         className="hts-theme-choice flex min-h-20 items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring data-[selected=true]:border-primary data-[selected=true]:bg-accent">
         <span className="flex size-12 shrink-0 overflow-hidden rounded-md border border-border/70" aria-hidden="true"><span className="w-1/2" style={{background:option.colors[0]}}/><span className="flex w-1/2 flex-col"><span className="h-1/2" style={{background:option.colors[1]}}/><span className="h-1/2" style={{background:option.colors[2]}}/></span></span>
         <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{option.label}</span><span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</span></span>
         {preset===option.id&&<Check className="size-4 shrink-0 text-primary"/>}
       </button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <span className="text-xs text-muted-foreground">Les préférences sont enregistrées automatiquement sur cet appareil.</span>
      <Button type="button" variant="outline" size="sm" onClick={reset}><RotateCcw className="size-3.5"/> Réinitialiser</Button>
    </div>
   </div>
  </SectionCard>
  <SectionCard title="Animations & transitions" description="Choisissez la façon dont l'accueil révèle l'application." className="max-w-3xl">
    <div className="space-y-2" role="group" aria-label="Transition d'ouverture">
      {welcomeTransitions.map(option=><button key={option.id} type="button" aria-pressed={transition===option.id} data-selected={transition===option.id} onClick={()=>setTransition(option.id)}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring data-[selected=true]:border-primary data-[selected=true]:bg-accent">
       <WandSparkles className="size-4 shrink-0 text-primary"/><span className="flex-1"><span className="block text-xs font-semibold">{option.label}</span><span className="block text-[11px] text-muted-foreground">{option.description}</span></span>
       {transition===option.id?<Check className="size-4 text-primary"/>:<CircleDot className="size-4 text-muted-foreground/60"/>}
      </button>)}
      <p className="text-[11px] leading-relaxed text-muted-foreground">Sauvegarde automatique sur ce PC. Les animations respectent le réglage système « Réduire les mouvements ».</p>
    </div>
  </SectionCard>
 </div>;
}
