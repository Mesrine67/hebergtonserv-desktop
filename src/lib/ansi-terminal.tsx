import type { CSSProperties, ReactNode } from "react";
type Segment = { text: string; style: CSSProperties };
type AnsiState = { bold: boolean; dim: boolean; fg?: string; bg?: string };
const basic = [
  "#171717", "#ef4444", "#22c55e", "#eab308",
  "#60a5fa", "#d946ef", "#22d3ee", "#e5e7eb",
  "#737373", "#f87171", "#4ade80", "#fde047",
  "#93c5fd", "#e879f9", "#67e8f9", "#ffffff",
] as const;
const clamp = (n: number) => Math.min(255, Math.max(0, Math.trunc(n)));
function color256(index: number): string {
  if (index < 16) return basic[index] ?? basic[7];
  if (index < 232) {
    const n = index - 16;
    const steps = [0, 95, 135, 175, 215, 255];
    return "rgb(" + [steps[Math.trunc(n / 36)],steps[Math.trunc(n / 6) % 6],steps[n % 6]].join(",") + ")";
  }
  const gray = (index - 232) * 10 + 8;
  return "rgb(" + [gray,gray,gray].join(",") + ")";
}
function styleOf(state: AnsiState): CSSProperties {
  return { ...(state.fg ? { color: state.fg } : {}),
    ...(state.bg ? { backgroundColor: state.bg } : {}),
    ...(state.bold ? { fontWeight: 700 } : {}),
    ...(state.dim ? { opacity: .65 } : {}) };
}
function applySgr(state: AnsiState, params: number[]) {
  if (!params.length) params = [0];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) { state.bold = false; state.dim = false; state.fg = undefined; state.bg = undefined; }
    else if (p === 1) state.bold = true;
    else if (p === 2) state.dim = true;
    else if (p === 22) { state.bold = false; state.dim = false; }
    else if (p === 39) state.fg = undefined;
    else if (p === 49) state.bg = undefined;
    else if (p >= 30 && p <= 37) state.fg = basic[p - 30];
    else if (p >= 90 && p <= 97) state.fg = basic[p - 90 + 8];
    else if (p >= 40 && p <= 47) state.bg = basic[p - 40];
    else if (p >= 100 && p <= 107) state.bg = basic[p - 100 + 8];
    else if (p === 38 || p === 48) {
      const target = p === 38 ? "fg" : "bg";
      if (params[i+1] === 5 && Number.isFinite(params[i+2])) {
        state[target] = color256(clamp(params[i+2]));
        i += 2;
      } else if (params[i+1] === 2 && params.length >= i+5 && params.slice(i+2,i+5).every(Number.isFinite)) {
        const rgb = params.slice(i+2,i+5).map(clamp);
        state[target] = "rgb(" + rgb.join(",") + ")";
        i += 4;
      }
    }
  }
}
/** Interpret SGR only. Remove other escape/control sequences; never render HTML. */
export function parseAnsiLine(source: string): Segment[] {
  const state: AnsiState = { bold: false, dim: false };
  const results: Segment[] = [];
  const sanitized = source
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, match => match.endsWith("m") ? match : "")
    .replace(/[\x00-\x08\x0b-\x1a\x1c-\x1f\x7f]/g, "");
  const regex = /\x1b\[([0-9;]*)m/g;
  let cursor = 0;
  for (const hit of sanitized.matchAll(regex)) {
    const start = hit.index;
    if (start > cursor) results.push({ text: sanitized.slice(cursor, start), style: styleOf(state) });
    const values = hit[1] ? hit[1].split(";").map(Number) : [0];
    applySgr(state, values);
    cursor = start + hit[0].length;
  }
  if (cursor < sanitized.length) results.push({ text: sanitized.slice(cursor), style: styleOf(state) });
  return results;
}
export function plainTerminalLine(source: string): string {
  return parseAnsiLine(source).map(p => p.text).join("");
}
export function AnsiLine({ value }: { value: string }): ReactNode {
  return parseAnsiLine(value).map((segment, index) => <span key={index} style={segment.style}>{segment.text}</span>);
}
