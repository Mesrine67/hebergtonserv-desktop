import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type StylePreset = "mira" | "ocean" | "jade" | "plum" | "sand";
export type WelcomeTransition = "float" | "curtain" | "halo";
export const stylePresets: ReadonlyArray<{id:StylePreset; label:string; description:string; colors:readonly [string,string,string]}> = [
  {id:"mira",label:"Mira original",description:"Neutre et bleu HébergTonServ",colors:["#18181b","#27272a","#244dd5"]},
  {id:"ocean",label:"Océan",description:"Bleu profond et turquoise doux",colors:["#10242f","#204957","#21a4bf"]},
  {id:"jade",label:"Jade",description:"Vert feutré et surfaces minérales",colors:["#192a26","#345047","#43b18f"]},
  {id:"plum",label:"Prune",description:"Violet encré et lavande",colors:["#251b30","#483754","#a58bde"]},
  {id:"sand",label:"Sable",description:"Ambre discret et tons chauds",colors:["#312a25","#57463a","#d39a64"]}
];
export const welcomeTransitions: ReadonlyArray<{id:WelcomeTransition;label:string;description:string}> = [
  {id:"float",label:"Flottement",description:"Fondu et léger déplacement"},
  {id:"curtain",label:"Rideau",description:"Révélation verticale"},
  {id:"halo",label:"Halo",description:"Ouverture circulaire douce"}
];
type Settings = {preset:StylePreset;setPreset:(v:StylePreset)=>void;transition:WelcomeTransition;setTransition:(v:WelcomeTransition)=>void};
const Context = createContext<Settings>({preset:"mira",setPreset:()=>{},transition:"float",setTransition:()=>{}});
function read<T extends string>(key:string,items:readonly T[],fallback:T):T {
  try { const v=window.localStorage.getItem(key); if(v&&items.includes(v as T))return v as T; } catch { /* WebView storage may be blocked */ }
  return fallback;
}
export function ThemeStyleProvider({children}:{children:ReactNode}) {
 const [preset,setPreset]=useState<StylePreset>(()=>read("hts-style-preset",stylePresets.map(x=>x.id),"mira"));
 const [transition,setTransition]=useState<WelcomeTransition>(()=>read("hts-welcome-transition",welcomeTransitions.map(x=>x.id),"float"));
 useEffect(()=>{document.documentElement.dataset.htsPreset=preset;try{localStorage.setItem("hts-style-preset",preset)}catch{/* unavailable */}},[preset]);
 useEffect(()=>{document.documentElement.dataset.htsTransition=transition;try{localStorage.setItem("hts-welcome-transition",transition)}catch{/* unavailable */}},[transition]);
 const value=useMemo(()=>({preset,setPreset,transition,setTransition}),[preset,transition]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useThemeStyle(){return useContext(Context)}
