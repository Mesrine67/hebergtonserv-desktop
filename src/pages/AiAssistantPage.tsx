import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Bot, CheckCircle2, ExternalLink, FolderOpen, LoaderCircle, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Model = { id: string; displayName: string; isDefault: boolean };
type Catalog = { plan: string; models: Model[]; quota: { limited: boolean; resetsAt: number | null } | null };
type Reply = { threadId: string; text: string };
type Message = { sender: "user" | "assistant"; text: string };

const website = "https://chatgpt.com/";

export default function AiAssistantPage() {
  // A binary path is not a credential; persist only this setting, never prompts or tokens.
  const [binary, setBinary] = useState(() => {
    try { return localStorage.getItem("hts.codex.executable") ?? ""; } catch { return ""; }
  });
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [plan, setPlan] = useState("");
  const [quota, setQuota] = useState<Catalog["quota"]>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"connect" | "send" | null>(null);
  const ready = models.length > 0 && !!model;
  const selected = useMemo(() => models.find(item => item.id === model), [models, model]);

  useEffect(() => {
    if (!isTauri()) return;
    void invoke<string | null>("local_codex_suggest_executable").then(path => {
      if (path) setBinary(current => current || path);
    }).catch(() => undefined);
    // Discover a local installation only when the page is first mounted.
  }, []);

  function updateBinary(value: string) {
    setBinary(value);
    setModels([]);
    setModel("");
    setPlan("");
    setQuota(null);
    setMessages([]);
    setThreadId(null);
    try { localStorage.setItem("hts.codex.executable", value); } catch { /* optional */ }
  }

  async function chooseExecutable() {
    if (!isTauri()) return;
    const path = await open({ multiple: false, directory: false, filters: [{ name: "Codex", extensions: ["exe"] }] });
    if (typeof path === "string") updateBinary(path);
  }

  async function connect() {
    if (!isTauri()) { toast.error("Le moteur Codex nécessite l'application Windows."); return; }
    setBusy("connect");
    try {
      const catalog = await invoke<Catalog>("local_codex_models", { executable: binary });
      setModels(catalog.models);
      setModel(catalog.models.find(item => item.isDefault)?.id ?? catalog.models[0]?.id ?? "");
      setPlan(catalog.plan);
      setQuota(catalog.quota);
      setMessages([]);
      setThreadId(null);
      if (!catalog.models.length) toast.error("Aucun modèle disponible sur ce compte.");
      else toast.success("Modèles Codex chargés depuis le compte ChatGPT.");
    } catch (error) {
      setModels([]);
      setModel("");
      setQuota(null);
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const text = prompt.trim();
    if (!ready || quota?.limited || !text || busy) return;
    const previous = threadId;
    setMessages(items => [...items, { sender: "user", text }]);
    setPrompt("");
    setBusy("send");
    try {
      const reply = await invoke<Reply>("local_codex_message", {
        executable: binary,
        threadId: previous,
        model,
        prompt: text,
      });
      setThreadId(reply.threadId);
      setMessages(items => [...items, { sender: "assistant", text: reply.text }]);
    } catch (error) {
      // Keep the user input available for retry; no failed turn is silently marked complete.
      setPrompt(text);
      toast.error(String(error));
    } finally {
      setBusy(null);
    }
  }

  function openWebsite() {
    if (isTauri()) void openUrl(website).catch(() => toast.error("Impossible d'ouvrir ChatGPT Web."));
    else window.open(website, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="INTELLIGENCE ARTIFICIELLE" title="Assistant IA"
        description="ChatGPT Web, Codex avec le forfait ChatGPT et intégrations MCP : des modes clairement séparés." />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ExternalLink className="size-4" /> ChatGPT Web</CardTitle>
            <CardDescription>Ouvre le véritable site ChatGPT dans ton navigateur. Les conversations restent gérées par ChatGPT.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={openWebsite}><ExternalLink className="mr-2 size-4" /> Ouvrir chatgpt.com</Button>
            <p className="mt-3 text-xs text-muted-foreground">Les endpoints privés backend-api ne sont ni utilisés ni copiés dans cette application.</p>
          </CardContent>
        </Card>
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="size-4" /> Agent Codex local</CardTitle>
            <CardDescription>App Server officiel via stdio, compte ChatGPT obligatoire, exécution en lecture seule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label htmlFor="codex-exe" className="text-xs font-medium">Codex approuvé sur E: ou chemin HTS_CODEX_EXECUTABLE</label>
            <div className="flex gap-2">
              <Input id="codex-exe" value={binary} onChange={event => updateBinary(event.target.value)}
                placeholder="E:\\DevCaches\\...\\codex.exe" className="min-w-0 flex-1 text-xs" />
              <Button type="button" size="icon" variant="outline" aria-label="Choisir Codex" onClick={() => void chooseExecutable()}><FolderOpen className="size-4" /></Button>
            </div>
            <Button disabled={!binary || !!busy} onClick={() => void connect()}>
              {busy === "connect" ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
              Vérifier mon compte ChatGPT
            </Button>
            {ready && <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4" /> Compte ChatGPT connecté · {plan}</p>}
            {quota?.limited && <p role="alert" className="text-xs text-destructive">Quota Codex atteint.{quota.resetsAt ? ` Réinitialisation estimée : ${new Date(quota.resetsAt * 1000).toLocaleString("fr-FR")}.` : " Réessayez après la réinitialisation du forfait."}</p>}
          </CardContent>
        </Card>
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4" /> ChatGPT plan · Responses API</CardTitle>
            <CardDescription>Intégration officielle Sign in with ChatGPT, distincte de Codex.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              L'authentification directe nécessite l'enregistrement OAuth de HébergTonServ Desktop.
              Ce mode sera activé après l'autorisation de l'application ; aucune clé API facturable n'est demandée ici.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="size-5" /> Conversation Codex</CardTitle>
          <CardDescription>Les réponses restent dans cette fenêtre pendant la session. Aucune commande de modification de fichiers n'est accordée par ce panneau.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <label htmlFor="ai-model" className="text-sm">Modèle du compte</label>
            <select id="ai-model" value={model} disabled={!ready || !!busy}
              onChange={event => { setModel(event.target.value); setMessages([]); setThreadId(null); }}
              className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm">
              {!ready && <option value="">Vérifier le compte d'abord</option>}
              {models.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
            </select>
            {selected && <span className="text-xs text-muted-foreground">{selected.displayName} · forfait ChatGPT</span>}
            <Button size="sm" variant="outline" disabled={!ready || !!busy}
              onClick={() => { setMessages([]); setThreadId(null); }}>Nouvelle discussion</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div role="log" aria-label="Conversation Codex" className="flex min-h-48 max-h-[50vh] flex-col gap-3 overflow-y-auto rounded-md border bg-muted/10 p-4">
            {!messages.length && <p className="text-sm text-muted-foreground">Connecte Codex, puis pose une question pour démarrer une discussion.</p>}
            {messages.map((item, index) => (
              <div key={index} className={`max-w-[94%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words ${item.sender === "user" ? "self-end bg-primary text-primary-foreground" : "self-start border bg-card text-card-foreground"}`}>
                {item.text}
              </div>
            ))}
            {busy === "send" && <p role="status" className="text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline size-4 animate-spin" /> Codex répond…</p>}
          </div>
          <label htmlFor="ai-prompt" className="text-sm font-medium">Message</label>
          <Textarea id="ai-prompt" value={prompt} onChange={event => setPrompt(event.target.value)}
            maxLength={8000} placeholder="Décris une erreur ou pose une question…" rows={3}
            disabled={!ready || !!busy || !!quota?.limited} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Lecture seule · 8 000 caractères maximum · aucun appel backend-api privé.</span>
            <Button onClick={() => void send()} disabled={!prompt.trim() || !ready || !!busy || !!quota?.limited}><Send className="mr-2 size-4" /> Envoyer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
