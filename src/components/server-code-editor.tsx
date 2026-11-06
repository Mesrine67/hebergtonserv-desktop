import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Copy, RefreshCw, RotateCcw, Save, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import "./server-code-editor.css";

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
const languageKeywords: Record<string, string> = {
  JSON: "true false null", JSONC: "true false null", JSON5: "true false null Infinity NaN",
  JavaScript: "const let var function return export import from default if else switch case break continue for while do try catch finally throw new this class extends super async await yield typeof instanceof in of void delete true false null undefined NaN Infinity",
  "JavaScript JSX": "const let var function return export import from default if else switch case break continue for while do try catch finally throw new this class extends super async await yield typeof instanceof in of void delete true false null undefined",
  TypeScript: "const let var function return export import from default if else switch case break continue for while do try catch finally throw new this class extends super async await yield typeof instanceof in of void delete interface type enum implements public private protected readonly abstract declare namespace keyof infer is as satisfies unknown any never string number boolean object symbol bigint true false null undefined",
  "TypeScript JSX": "const let var function return export import from default if else switch case break continue for while do try catch finally throw new this class extends super async await yield typeof instanceof in of void delete interface type enum implements public private protected readonly abstract declare namespace keyof infer is as satisfies unknown any never string number boolean object symbol bigint true false null undefined",
  YAML: "true false null yes no on off", Lua: "and break do else elseif end false for function if in local nil not or repeat return then true until while goto",
  Python: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self",
  Shell: "if then else elif fi for while until do done case esac function in select local export readonly declare typeset unset shift source return exit break continue eval exec set alias trap true false",
  TOML: "true false", INI: "true false yes no on off", Configuration: "true false on off yes no include server location listen root index proxy_pass upstream ensure start stop set sets", Config: "true false on off yes no include server location listen root index proxy_pass upstream ensure start stop set sets",
  SQL: "select from where insert into values update set delete create alter drop table database index view join left right inner outer on as and or not null is like between in group by order having limit offset distinct union all primary key foreign references default constraint count sum avg min max case when then end else desc asc begin commit rollback",
  Rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while",
  Go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil",
  Java: "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws try void volatile while true false null",
  "C#": "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implements implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while",
  PHP: "abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty endfor endforeach endif endswitch endwhile eval exit extends final finally fn for foreach function global goto if implements include include_once instanceof interface isset list namespace new or print private protected public require require_once return static switch throw trait try unset use var while xor yield true false null",
  Ruby: "alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield",
  PowerShell: "begin break catch class continue data do dynamicparam else elseif end exit filter finally for foreach from function if in param process return switch throw trap try until using while true false null",
  GraphQL: "query mutation subscription fragment on type input enum interface union scalar schema directive extend implements true false null",
  HCL: "true false null resource data variable output provider module locals terraform required_providers", Terraform: "true false null resource data variable output provider module locals terraform required_providers",
  Dockerfile: "from run cmd entrypoint copy add env arg expose volume user workdir label shell healthcheck stopsignal onbuild",
  Makefile: "include define endef export unexport override private vpath ifdef ifndef ifeq ifneq else endif",
  C: "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while",
  "C++": "alignas alignof and asm auto bool break case catch char class const constexpr continue decltype default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not nullptr operator private protected public register return short signed sizeof static static_assert struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile while",
  Kotlin: "as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while",
};

export function serverFileLanguage(path: string): string {
  const fileName = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (fileName.startsWith(".env.")) return "Configuration";
  if (knownConfigFiles.has(fileName)) return ["dockerfile", "containerfile"].includes(fileName) ? "Dockerfile" : fileName === "makefile" ? "Makefile" : "Config";
  const extension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : fileName;
  return languageByExtension[extension] ?? "Texte brut";
}

function highlightCode(source: string, language: string): ReactNode[] {
  const hashCommentLanguages = ["YAML", "Python", "Shell", "TOML", "INI", "Properties", "Configuration", "Config", "HCL", "Terraform", "GraphQL", "Ruby", "PowerShell", "Dockerfile", "Makefile"];
  const comment = ["JSON", "XML", "SVG", "HTML", "Texte brut"].includes(language) ? "(?!x)x"
    : language === "Markdown" ? "<!--[\\s\\S]*?-->"
    : hashCommentLanguages.includes(language) ? "(^|\\s)#.*"
      : language === "SQL" ? "--.*|/\\*[\\s\\S]*?\\*/"
        : language === "Lua" ? "--.*"
          : language === "CSS" ? "/\\*[\\s\\S]*?\\*/"
            : language === "SCSS" || language === "Less" ? "//.*|/\\*[\\s\\S]*?\\*/"
              : "//.*|/\\*[\\s\\S]*?\\*/";
  const quote = ["JSON", "JSONC"].includes(language) ? "\"(?:\\\\.|[^\"\\\\])*\""
    : "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|\\x60(?:\\\\.|[^\\x60\\\\])*\\x60";
  const tokenPattern = new RegExp("(" + quote + ")|(" + comment + ")|([A-Za-z_$][\\w$-]*)|(-?(?:0[xX][\\da-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?))|([{}\\[\\]():,.;=+*/<>!?|&-])", "g");
  const keywords = new Set((languageKeywords[language] ?? "").split(/\s+/).filter(Boolean).map(word => word.toLowerCase()));
  const tokens: ReactNode[] = [];
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) tokens.push(source.slice(cursor, index));
    const value = match[0];
    const kind = match[1] ? "string" : match[2] ? "comment"
      : match[3] && keywords.has(value.toLowerCase()) ? "keyword"
      : match[3] && ["HTML", "XML", "SVG"].includes(language) && /<\/?\s*$/.test(source.slice(0, index)) ? "tag"
      : match[3] && /^\s*[:=]/.test(source.slice(index + value.length)) ? "property"
      : match[3] ? "variable" : match[4] ? "number" : match[5] ? "punctuation" : "plain";
    tokens.push(<span key={index} className={"hts-code-" + kind}>{value}</span>);
    cursor = index + value.length;
  }
  if (cursor < source.length) tokens.push(source.slice(cursor));
  if (!tokens.length) tokens.push(source || " ");
  return tokens;
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
  const textarea = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [wrap, setWrap] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [copied, setCopied] = useState(false);
  const dirty = value !== original;
  const lines = useMemo(() => value.split("\n").length, [value]);
  const language = serverFileLanguage(path);
  const highlighted = useMemo(() => highlightCode(value, language), [value, language]);
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
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{language}</span>
        {dirty && <span role="status" className="text-[10px] text-amber-500">Modifié</span>}
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing} aria-label="Actualiser les fichiers du serveur"><RefreshCw className={refreshing ? "animate-spin" : ""}/>Actualiser</Button>
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
