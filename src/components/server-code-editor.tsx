import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Copy, RotateCcw, Save, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import "./server-code-editor.css";

const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|#[^\n]*|\b(?:const|let|var|function|return|export|import|if|else|async|await|true|false|null|undefined|class|public|private|use|local|server|name|port)\b|\b\d+(?:\.\d+)?\b)/g;

function highlightCode(source: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) tokens.push(source.slice(cursor, index));
    const value = match[0];
    const kind = value.startsWith("//") || value.startsWith("#") ? "comment"
      : value.startsWith('"') || value.startsWith("'") ? "string"
      : /^\d/.test(value) ? "number" : "keyword";
    tokens.push(<span key={index} className={"hts-code-" + kind}>{value}</span>);
    cursor = index + value.length;
  }
  if (cursor < source.length) tokens.push(source.slice(cursor));
  if (!tokens.length) tokens.push(source || " ");
  return tokens;
}

export function serverFileLanguage(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const languages: Record<string, string> = {
    json: "JSON", jsonc: "JSON", json5: "JSON", ts: "TypeScript",
    tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
    yaml: "YAML", yml: "YAML", lua: "Lua", py: "Python",
    sh: "Shell", bash: "Shell", toml: "TOML", ini: "INI",
    cfg: "Config", properties: "Properties", xml: "XML", html: "HTML",
    css: "CSS", sql: "SQL", md: "Markdown",
  };
  return languages[extension] ?? "Texte brut";
}

type Props = {
  path: string;
  value: string;
  original: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
};

export function ServerCodeEditor({ path, value, original, onChange, onSave, saving }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [wrap, setWrap] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [copied, setCopied] = useState(false);
  const dirty = value !== original;
  const lines = useMemo(() => value.split("\n").length, [value]);
  const highlighted = useMemo(() => highlightCode(value), [value]);
  const fileName = path.split("/").pop() ?? path;

  async function copyCode() {
    try {
      if (isTauri()) await writeText(value);
      else await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Contenu du fichier copié.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier le contenu du fichier.");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (dirty && !saving) onSave();
    }
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const field = event.currentTarget;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      if (event.shiftKey) {
        const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const indentation = value.slice(lineStart).match(/^( {1,2}|\t)/)?.[0] ?? "";
        if (!indentation) return;
        onChange(value.slice(0, lineStart) + value.slice(lineStart + indentation.length));
        requestAnimationFrame(() => {
          field.selectionStart = Math.max(lineStart, start - indentation.length);
          field.selectionEnd = Math.max(lineStart, end - indentation.length);
        });
        return;
      }
      onChange(value.slice(0, start) + "  " + value.slice(end));
      requestAnimationFrame(() => {
        field.selectionStart = start + 2;
        field.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="hts-code-editor flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-destructive/60"/>
          <span className="size-2 rounded-full bg-amber-500/60"/>
          <span className="size-2 rounded-full bg-emerald-500/60"/>
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium" title={path}>{fileName}</span>
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{serverFileLanguage(path)}</span>
        {dirty && <span role="status" className="text-[10px] text-amber-500">Modifié</span>}
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowNumbers(v => !v)} aria-label="Afficher ou masquer les numéros de ligne" aria-pressed={showNumbers}>#</Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setWrap(v => !v)} aria-label="Retour à la ligne automatique" aria-pressed={wrap}><WrapText className="size-3.5"/></Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copyCode()} aria-label="Copier le code">{copied ? <Check className="size-3.5"/> : <Copy className="size-3.5"/>}</Button>
        <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => onChange(original)}><RotateCcw className="size-3.5"/> Annuler</Button>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={onSave}><Save className="size-3.5"/> {saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {showNumbers && !wrap && (
          <div ref={gutter} aria-hidden="true" className="hts-code-gutter shrink-0 overflow-hidden border-r px-2 py-3 text-right font-mono text-xs leading-6 text-muted-foreground/60">
            {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
        )}
        <div className="relative min-w-0 flex-1">
          <pre ref={overlay} aria-hidden="true" className={"hts-code-overlay absolute inset-0 m-0 overflow-hidden px-3 py-3 font-mono text-xs leading-6 " + (wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>{highlighted}{"\n"}</pre>
          <textarea
            ref={textarea}
            aria-label={"Éditeur du fichier " + fileName}
            spellCheck={false}
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={event => {
              if (overlay.current) {
                overlay.current.scrollTop = event.currentTarget.scrollTop;
                overlay.current.scrollLeft = event.currentTarget.scrollLeft;
              }
              if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
            }}
            wrap={wrap ? "soft" : "off"}
            className={"hts-code-input absolute inset-0 size-full resize-none overflow-auto bg-transparent px-3 py-3 font-mono text-xs leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring/45 " + (wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/15 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>{lines} ligne(s) · {value.length} caractères</span>
        <span>Tab : indentation · Ctrl+S : enregistrer</span>
      </div>
    </div>
  );
}
