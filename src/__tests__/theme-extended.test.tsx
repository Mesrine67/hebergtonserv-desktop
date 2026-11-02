// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeStyleProvider, useThemeStyle } from "../lib/theme-style";

function Harness(){
 const {visualStyle,setVisualStyle,baseColor,setBaseColor,accentTheme,setAccentTheme,preset,setPreset}=useThemeStyle();
 return <div><span data-testid="current">{visualStyle}/{baseColor}/{accentTheme}/{preset}</span>
  <button onClick={()=>setVisualStyle("rhea")}>Rhea</button>
  <button onClick={()=>setBaseColor("mauve")}>Mauve</button>
  <button onClick={()=>setAccentTheme("teal")}>Teal</button>
  <button onClick={()=>setPreset("hebergtonserv")}>HébergTonServ</button>
 </div>;
}

describe("Extended shadcn appearance options",()=>{
 beforeEach(()=>{(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;window.localStorage.clear();});
 afterEach(()=>{document.body.innerHTML="";for(const key of ["htsStyle","htsBase","htsAccent","htsPreset"] as const)delete document.documentElement.dataset[key];});
 it("persists independent style, base, accent and brand preset",async()=>{
  const node=document.createElement("div");document.body.appendChild(node);const root=createRoot(node);
  await act(async()=>root.render(<ThemeStyleProvider><Harness/></ThemeStyleProvider>));
  for(const button of Array.from(node.querySelectorAll("button")))await act(async()=>button.click());
  expect(node.querySelector('[data-testid="current"]')?.textContent).toBe("rhea/mauve/teal/hebergtonserv");
  expect(document.documentElement.dataset.htsStyle).toBe("rhea");
  expect(document.documentElement.dataset.htsBase).toBe("mauve");
  expect(document.documentElement.dataset.htsAccent).toBe("teal");
  expect(localStorage.getItem("hts-style-preset")).toBe("hebergtonserv");
  await act(async()=>root.unmount());
 });
 it("rejects invalid saved dynamic theme choices",async()=>{
  localStorage.setItem("hts-visual-style","unknown");localStorage.setItem("hts-base-color","unknown");
  localStorage.setItem("hts-accent-theme","unknown");
  const node=document.createElement("div");document.body.appendChild(node);const root=createRoot(node);
  await act(async()=>root.render(<ThemeStyleProvider><Harness/></ThemeStyleProvider>));
  expect(node.querySelector('[data-testid="current"]')?.textContent).toBe("mira/neutral/original/mira");
  await act(async()=>root.unmount());
 });
});
