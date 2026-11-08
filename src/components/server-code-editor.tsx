import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "../../node_modules/monaco-editor/esm/vs/editor/editor.api.js";
import { useTheme } from "next-themes";
import { Check, Copy, Eye, EyeOff, File, Keyboard, RefreshCw, RotateCcw, Save, WrapText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { buildSafeMonacoPreview } from "@/lib/monaco-preview";
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
  tabs?: { path: string; name: string; dirty: boolean }[];
  onSelectTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
};

export function ServerCodeEditor({ path, value, original, onChange, onSave, saving, onRefresh, refreshing, tabs = [], onSelectTab, onCloseTab }: Props) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const saveRef = useRef(onSave);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const [wrap, setWrap] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { resolvedTheme } = useTheme();
  const dirty = value !== original;
  const lines = useMemo(() => value.split("\n").length, [value]);
  const languageId = serverFileMonacoLanguage(path);
  const previewDocument = useMemo(() => buildSafeMonacoPreview(path, value), [path, value]);
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
    <div className="hts-code-editor flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex min-w-0 items-stretch border-b bg-muted/20 px-2">
        <div role="tablist" aria-label="Fichiers ouverts dans cet éditeur" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {tabs.map(tab => <div key={tab.path} role="presentation" className={`group flex max-w-56 shrink-0 items-center border-r border-border/60 ${tab.path === path ? "border-t-2 border-t-muted-foreground/60 bg-background" : "border-t-2 border-t-transparent"}`}>
            <button type="button" role="tab" aria-selected={tab.path === path} title={tab.path} onClick={() => onSelectTab?.(tab.path)} className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs hover:bg-accent/60">
              <File className="size-3.5 shrink-0 text-muted-foreground"/><span className="truncate font-mono">{tab.name}</span>{tab.dirty && <span aria-label="Modifications non enregistrées" className="size-2 shrink-0 rounded-full bg-amber-500"/>}
            </button>
            <button type="button" aria-label={`Fermer ${tab.name}`} onClick={() => onCloseTab?.(tab.path)} className="mr-1 rounded p-1 text-muted-foreground opacity-70 hover:bg-accent hover:text-foreground group-hover:opacity-100"><X className="size-3.5"/></button>
          </div>)}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 border-b bg-muted/10 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate pr-2 font-mono text-[10px] text-muted-foreground" title={path}>{path}</span>
        {dirty && <span role="status" className="text-[10px] text-amber-500">Modifié</span>}
      </div>
      <div className="hts-monaco-container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="min-h-[160px] min-w-0 flex-1 overflow-hidden">
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
        {showPreview && previewDocument && <section className="flex min-h-[150px] min-w-0 flex-1 flex-col border-t lg:border-l lg:border-t-0" aria-label="Prévisualisation isolée HTML et CSS">
          <div className="border-b bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">Aperçu isolé · scripts et réseau bloqués</div>
          <iframe title="Aperçu sécurisé du code" sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument} className="min-h-0 w-full flex-1 bg-white" />
        </section>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/15 px-3 py-1 text-[10px] text-muted-foreground">
        <span className="shrink-0">{lines} ligne(s) · {value.length} caractères</span>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
          <Popover>
            <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2" aria-label="Raccourcis clavier de l’éditeur" title="Raccourcis clavier"><Keyboard className="size-3.5"/><span className="hidden md:inline">Raccourcis</span></Button></PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-72 gap-2 p-3">
              <h3 className="font-medium">Raccourcis de code</h3>
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-muted-foreground">
                <span>Annuler / rétablir</span><kbd className="font-mono text-foreground">Ctrl+Z / Ctrl+Y</kbd>
                <span>Rechercher / remplacer</span><kbd className="font-mono text-foreground">Ctrl+F / Ctrl+H</kbd>
                <span>Commenter la ligne</span><kbd className="font-mono text-foreground">Ctrl+/</kbd>
                <span>Déplacer la ligne</span><kbd className="font-mono text-foreground">Alt+↑ / Alt+↓</kbd>
                <span>Copier la ligne vers le bas</span><kbd className="font-mono text-foreground">Shift+Alt+↓</kbd>
                <span>Sélectionner l’occurrence suivante</span><kbd className="font-mono text-foreground">Ctrl+D</kbd>
                <span>Enregistrer</span><kbd className="font-mono text-foreground">Ctrl+S</kbd>
                <span>Insérer une tabulation</span><kbd className="font-mono text-foreground">Tab</kbd>
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={onRefresh} disabled={refreshing} aria-label="Actualiser les fichiers du serveur" title="Actualiser les fichiers du serveur"><RefreshCw className={refreshing ? "animate-spin" : "size-3.5"} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={() => setShowNumbers(v => !v)} aria-label="Afficher ou masquer les numéros de ligne" aria-pressed={showNumbers} title="Numéros de ligne">#</Button>
          {previewDocument && <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setShowPreview(v => !v)} aria-label={showPreview ? "Fermer la prévisualisation sécurisée" : "Ouvrir la prévisualisation sécurisée"} aria-pressed={showPreview} title="Aperçu HTML/CSS sans script ni réseau">{showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}<span className="hidden sm:inline">Aperçu</span></Button>}
          <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={() => setWrap(v => !v)} aria-label="Retour à la ligne automatique" aria-pressed={wrap} title="Retour à la ligne"><WrapText className="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={() => void copyCode()} aria-label="Copier le code" title="Copier le code">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</Button>
          <Button type="button" variant="ghost" size="icon-sm" className="size-7" disabled={!dirty || saving} onClick={() => onChange(original)} aria-label="Annuler les modifications" title="Annuler les modifications"><RotateCcw className="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" disabled={!dirty || saving} onClick={onSave} aria-label="Enregistrer le fichier" title="Enregistrer le fichier"><Save className="size-3.5" /><span className="hidden sm:inline">{saving ? "Enregistrement…" : "Enregistrer"}</span></Button>
          <span className="hidden whitespace-nowrap pl-1 sm:inline">Ctrl+S · Tab : indentation</span>
        </div>
      </div>
    </div>
  );
}
