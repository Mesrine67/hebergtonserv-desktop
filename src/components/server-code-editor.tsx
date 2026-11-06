import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "../../node_modules/monaco-editor/esm/vs/editor/editor.api.js";
import { useTheme } from "next-themes";
import { Check, Copy, RefreshCw, RotateCcw, Save, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import "../../node_modules/monaco-editor/min/vs/editor/editor.main.css";
import "../../node_modules/monaco-editor/esm/vs/language/json/monaco.contribution.js";
import "../../node_modules/monaco-editor/esm/vs/language/css/monaco.contribution.js";
import "../../node_modules/monaco-editor/esm/vs/language/html/monaco.contribution.js";
import "../../node_modules/monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/bat/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/cpp/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/csharp/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/dockerfile/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/go/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/graphql/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/hcl/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/ini/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/java/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/kotlin/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/less/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/lua/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/markdown/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/php/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/powershell/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/python/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/ruby/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/rust/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/scss/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/shell/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/sql/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/xml/register.js";
import "../../node_modules/monaco-editor/esm/vs/languages/definitions/yaml/register.js";
import "./server-code-editor.css";

loader.config({ monaco });

const languageByExtension: Record<string, string> = {
  json: "JSON", jsonc: "JSONC", json5: "JSON5", js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", jsx: "JavaScript JSX",
  ts: "TypeScript", mts: "TypeScript", cts: "TypeScript", tsx: "TypeScript JSX", yaml: "YAML", yml: "YAML", lua: "Lua",
  py: "Python", pyw: "Python", pyi: "Python", sh: "Shell", bash: "Shell", zsh: "Shell", fish: "Shell", toml: "TOML",
  ini: "INI", properties: "Properties", conf: "Config", cfg: "Config", config: "Config", xml: "XML", svg: "SVG",
  html: "HTML", htm: "HTML", xhtml: "HTML", css: "CSS", scss: "SCSS", sass: "Sass", less: "Less", sql: "SQL", md: "Markdown",
  markdown: "Markdown", mdown: "Markdown", rs: "Rust", go: "Go", java: "Java", kt: "Kotlin", kts: "Kotlin", cs: "C#", c: "C",
  h: "C", cc: "C++", cpp: "C++", hpp: "C++", php: "PHP", phtml: "PHP", rb: "Ruby", rake: "Ruby", ps1: "PowerShell",
  psm1: "PowerShell", bat: "Batch", cmd: "Batch", diff: "Diff", patch: "Diff", graphql: "GraphQL", gql: "GraphQL", hcl: "HCL",
  tf: "Terraform", tfvars: "Terraform", log: "Log",
};
const knownConfigFiles = new Set([".env", ".env.local", ".env.development", ".env.production", ".gitignore", ".gitattributes", ".editorconfig", ".htaccess", "makefile", "containerfile", "dockerfile", "nginx.conf", "caddyfile"]);

const monacoLanguageByLabel: Record<string, string> = {
  JSON: "json", JSONC: "json", JSON5: "json", JavaScript: "javascript", "JavaScript JSX": "javascript",
  TypeScript: "typescript", "TypeScript JSX": "typescript", YAML: "yaml", Lua: "lua", Python: "python", Shell: "shell",
  TOML: "ini", INI: "ini", Properties: "ini", Configuration: "ini", Config: "ini", XML: "xml", SVG: "xml", HTML: "html",
  CSS: "css", SCSS: "scss", Sass: "scss", Less: "less", SQL: "sql", Markdown: "markdown", Rust: "rust", Go: "go",
  Java: "java", Kotlin: "kotlin", "C#": "csharp", C: "cpp", "C++": "cpp", PHP: "php", Ruby: "ruby", PowerShell: "powershell",
  Batch: "bat", Diff: "plaintext", GraphQL: "graphql", HCL: "hcl", Terraform: "hcl", Dockerfile: "dockerfile", Makefile: "plaintext", Log: "plaintext",
};

export function serverFileLanguage(path: string): string {
  const fileName = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (fileName.startsWith(".env.")) return "Config";
  if (knownConfigFiles.has(fileName)) return ["dockerfile", "containerfile"].includes(fileName) ? "Dockerfile" : fileName === "makefile" ? "Makefile" : "Config";
  const extension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : fileName;
  return languageByExtension[extension] ?? "Texte brut";
}

export function serverFileMonacoLanguage(path: string): string {
  return monacoLanguageByLabel[serverFileLanguage(path)] ?? "plaintext";
}

type Props = {
  path: string;
  value: string;
  original: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  onRefresh: () => void;
  refreshing: boolean;
};

export function ServerCodeEditor({ path, value, original, onChange, onSave, saving, onRefresh, refreshing }: Props) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const saveRef = useRef(onSave);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const [wrap, setWrap] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const dirty = value !== original;
  const lines = useMemo(() => value.split("\n").length, [value]);
  const language = serverFileLanguage(path);
  const languageId = serverFileMonacoLanguage(path);
  const fileName = path.split("/").pop() ?? path;
  saveRef.current = onSave;
  dirtyRef.current = dirty;
  savingRef.current = saving;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ wordWrap: wrap ? "on" : "off", lineNumbers: showNumbers ? "on" : "off" });
  }, [wrap, showNumbers]);

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

  return (
    <div className="hts-code-editor flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-destructive/60" />
          <span className="size-2 rounded-full bg-amber-500/60" />
          <span className="size-2 rounded-full bg-emerald-500/60" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium" title={path}>{fileName}</span>
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{language}</span>
        {dirty && <span role="status" className="text-[10px] text-amber-500">Modifié</span>}
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing} aria-label="Actualiser les fichiers du serveur"><RefreshCw className={refreshing ? "animate-spin" : ""} />Actualiser</Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowNumbers(v => !v)} aria-label="Afficher ou masquer les numéros de ligne" aria-pressed={showNumbers}>#</Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setWrap(v => !v)} aria-label="Retour à la ligne automatique" aria-pressed={wrap}><WrapText className="size-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copyCode()} aria-label="Copier le code">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
        <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => onChange(original)}><RotateCcw className="size-3.5" /> Annuler</Button>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={onSave}><Save className="size-3.5" /> {saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
      <div className="hts-monaco-container min-h-0 min-w-0 flex-1 overflow-hidden">
        <Editor
          path={path}
          value={value}
          language={languageId}
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          loading={<div className="grid h-full place-items-center text-xs text-muted-foreground">Chargement de l’éditeur…</div>}
          onChange={next => onChange(next ?? "")}
          onMount={editor => {
            editorRef.current = editor;
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              if (dirtyRef.current && !savingRef.current) saveRef.current();
            });
          }}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: wrap ? "on" : "off",
            lineNumbers: showNumbers ? "on" : "off",
            fontSize: 12,
            lineHeight: 24,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            renderLineHighlight: "line",
            roundedSelection: false,
            padding: { top: 10, bottom: 10 },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            folding: true,
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
            readOnly: false,
            ariaLabel: `Éditeur du fichier ${fileName}`,
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/15 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>{lines} ligne(s) · {value.length} caractères</span>
        <span>Tab : indentation · Ctrl+S : enregistrer</span>
      </div>
    </div>
  );
}
