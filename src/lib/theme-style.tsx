import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type StylePreset = "mira" | "ocean" | "jade" | "plum" | "sand" | "hebergtonserv";
export type VisualStyle = "vega" | "nova" | "maia" | "lyra" | "mira" | "luma" | "sera" | "rhea" | "hebergtonserv";
export type BaseColor = "neutral" | "stone" | "zinc" | "gray" | "mauve" | "olive" | "mist" | "taupe";
export type AccentTheme = "original" | "neutral" | "amber" | "blue" | "cyan" | "emerald" | "fuchsia" | "green" | "indigo" | "lime" | "orange" | "pink" | "purple" | "red" | "rose" | "sky" | "teal" | "violet" | "yellow";
export type WelcomeTransition = "float" | "curtain" | "halo";

export const visualStyles: ReadonlyArray<{id:VisualStyle;label:string;description:string}> = [
 {id:"vega",label:"Vega",description:"Classique et équilibré"},
 {id:"nova",label:"Nova",description:"Compact et précis"},
 {id:"maia",label:"Maia",description:"Doux, arrondi et aéré"},
 {id:"lyra",label:"Lyra",description:"Géométrique et net"},
 {id:"mira",label:"Mira",description:"Dense et professionnel"},
 {id:"luma",label:"Luma",description:"Clair, souple et discret"},
 {id:"sera",label:"Sera",description:"Élégant et spacieux"},
 {id:"rhea",label:"Rhea",description:"Cadres et hiérarchie marquée"},
 {id:"hebergtonserv",label:"HébergTonServ",description:"Surfaces sombres et bleu de la marque"},
];
export const baseColors: ReadonlyArray<{id:BaseColor;label:string}> = [
 {id:"neutral",label:"Neutral"},{id:"stone",label:"Stone"},{id:"zinc",label:"Zinc"},{id:"gray",label:"Gray"},
 {id:"mauve",label:"Mauve"},{id:"olive",label:"Olive"},{id:"mist",label:"Mist"},{id:"taupe",label:"Taupe"}
];
export const accentThemes: ReadonlyArray<{id:AccentTheme;label:string;swatch:string}> = [
 {id:"original",label:"Preset original",swatch:"#335bdf"},{id:"neutral",label:"Neutral",swatch:"#777780"},
 {id:"amber",label:"Amber",swatch:"#d18c27"},{id:"blue",label:"Blue",swatch:"#3b69e4"},
 {id:"cyan",label:"Cyan",swatch:"#16a5be"},{id:"emerald",label:"Emerald",swatch:"#18a979"},
 {id:"fuchsia",label:"Fuchsia",swatch:"#bb51d0"},{id:"green",label:"Green",swatch:"#32a36a"},
 {id:"indigo",label:"Indigo",swatch:"#6b64db"},{id:"lime",label:"Lime",swatch:"#7baf2d"},
 {id:"orange",label:"Orange",swatch:"#e1843a"},{id:"pink",label:"Pink",swatch:"#e16eac"},
 {id:"purple",label:"Purple",swatch:"#925fcb"},{id:"red",label:"Red",swatch:"#dc5b58"},
 {id:"rose",label:"Rose",swatch:"#db6385"},{id:"sky",label:"Sky",swatch:"#3a9fdb"},
 {id:"teal",label:"Teal",swatch:"#278f8c"},{id:"violet",label:"Violet",swatch:"#926de0"},
 {id:"yellow",label:"Yellow",swatch:"#caad33"}
];
export const stylePresets: ReadonlyArray<{id:StylePreset;label:string;description:string;colors:readonly [string,string,string]}> = [
 {id:"mira",label:"Mira original",description:"Neutre et bleu HébergTonServ",colors:["#18181b","#27272a","#244dd5"]},
 {id:"hebergtonserv",label:"HébergTonServ",description:"Bleu électrique, graphite et surfaces douces",colors:["#101727","#25334c","#3974ee"]},
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
type Settings = {
 preset:StylePreset;setPreset:(v:StylePreset)=>void;
 visualStyle:VisualStyle;setVisualStyle:(v:VisualStyle)=>void;
 baseColor:BaseColor;setBaseColor:(v:BaseColor)=>void;
 accentTheme:AccentTheme;setAccentTheme:(v:AccentTheme)=>void;
 transition:WelcomeTransition;setTransition:(v:WelcomeTransition)=>void
};
const Context=createContext<Settings>({
 preset:"mira",setPreset:()=>{},visualStyle:"mira",setVisualStyle:()=>{},
 baseColor:"neutral",setBaseColor:()=>{},accentTheme:"original",setAccentTheme:()=>{},
 transition:"float",setTransition:()=>{}
});
function read<T extends string>(key:string,items:readonly T[],fallback:T):T {
 try{const v=window.localStorage.getItem(key);if(v&&items.includes(v as T))return v as T;}catch{/* WebView storage unavailable */ }
 return fallback;
}
export function ThemeStyleProvider({children}:{children:ReactNode}) {
 const [preset,setPreset]=useState<StylePreset>(()=>read("hts-style-preset",stylePresets.map(x=>x.id),"mira"));
 const [visualStyle,setVisualStyle]=useState<VisualStyle>(()=>read("hts-visual-style",visualStyles.map(x=>x.id),"mira"));
 const [baseColor,setBaseColor]=useState<BaseColor>(()=>read("hts-base-color",baseColors.map(x=>x.id),"neutral"));
 const [accentTheme,setAccentTheme]=useState<AccentTheme>(()=>read("hts-accent-theme",accentThemes.map(x=>x.id),"original"));
 const [transition,setTransition]=useState<WelcomeTransition>(()=>read("hts-welcome-transition",welcomeTransitions.map(x=>x.id),"float"));
 useEffect(()=>{document.documentElement.dataset.htsPreset=preset;try{localStorage.setItem("hts-style-preset",preset)}catch{/* unavailable */}},[preset]);
 useEffect(()=>{document.documentElement.dataset.htsStyle=visualStyle;try{localStorage.setItem("hts-visual-style",visualStyle)}catch{/* unavailable */}},[visualStyle]);
 useEffect(()=>{document.documentElement.dataset.htsBase=baseColor;try{localStorage.setItem("hts-base-color",baseColor)}catch{/* unavailable */}},[baseColor]);
 useEffect(()=>{document.documentElement.dataset.htsAccent=accentTheme;try{localStorage.setItem("hts-accent-theme",accentTheme)}catch{/* unavailable */}},[accentTheme]);
 useEffect(()=>{document.documentElement.dataset.htsTransition=transition;try{localStorage.setItem("hts-welcome-transition",transition)}catch{/* unavailable */}},[transition]);
 const value=useMemo(()=>({preset,setPreset,visualStyle,setVisualStyle,baseColor,setBaseColor,accentTheme,setAccentTheme,transition,setTransition}),[preset,visualStyle,baseColor,accentTheme,transition]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useThemeStyle(){return useContext(Context)}
