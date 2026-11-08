import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, ExternalLink, LoaderCircle, LogIn, Send, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Status = { connected: boolean; planEnabled: boolean; account: string | null };
type Model = { id: string; name: string };
type ConversationMessage = { role: "user" | "assistant"; content: string };
type AuthNotice = { success: boolean; message: string };
type Delta = { runId: string; delta: string };
type Reply = { text: string };

export function ChatgptPlanPanel() {
  const [status, setStatus] = useState<Status>({ connected: false, planEnabled: false, account: null });
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modelsPending, setModelsPending] = useState(false);
  const loginListener = useRef<UnlistenFn | null>(null);
  const onScreen = useRef(true);

  const refreshStatus = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const current = await invoke<Status>("chatgpt_plan_status");
      if (onScreen.current) setStatus(current);
      if (current.planEnabled) {
        if (onScreen.current) setModelsPending(true);
        try {
          const list = await invoke<Model[]>("chatgpt_plan_models");
          if (!onScreen.current) return;
          setModels(list);
          setSelected(current => list.some(m => m.id === current) ? current : list[0]?.id ?? "");
        } finally {
          if (onScreen.current) setModelsPending(false);
        }
      } else if (onScreen.current) {
        setModels([]);
        setSelected("");
      }
    } catch (error) {
      toast.error(String(error));
    }
  }, []);

  useEffect(() => {
    onScreen.current = true;
    void refreshStatus();
    return () => {
      onScreen.current = false;
      loginListener.current?.();
      loginListener.current = null;
    };
  }, [refreshStatus]);

  async function signIn() {
    if (!isTauri() || loginPending || busy) return;
    setLoginPending(true);
    let cancel: UnlistenFn | null = null;
    try {
      cancel = await listen<AuthNotice>("hts:plan-auth", event => {
        cancel?.();
        loginListener.current = null;
        setLoginPending(false);
        if (event.payload.success) {
          toast.success(event.payload.message);
          setMessages([]);
          void refreshStatus();
        } else {
          toast.error(event.payload.message);
        }
      });
      loginListener.current?.();
      loginListener.current = cancel;
      const url = await invoke<string>("chatgpt_plan_login");
      await openUrl(url);
      toast.info("Autorise HébergTonServ dans ton navigateur. La connexion sera détectée automatiquement.");
    } catch (error) {
      cancel?.();
      loginListener.current = null;
      setLoginPending(false);
      toast.error(String(error));
    }
  }

  async function signOut() {
    if (busy || loginPending) return;
    try {
      await invoke("chatgpt_plan_logout");
      setStatus({ connected: false, planEnabled: false, account: null });
      setModels([]);
      setSelected("");
      setMessages([]);
      toast.success("Compte ChatGPT déconnecté de HébergTonServ.");
    } catch (error) {
      // Remote revocation might fail even when local tokens were deleted.
      toast.error(String(error));
      void refreshStatus();
    }
  }

  async function send() {
    const text = prompt.trim();
    if (!isTauri() || !status.planEnabled || !selected || !text || busy) return;
    const history = [...messages.filter(m => m.content.trim()), { role: "user" as const, content: text }].slice(-20);
    const request = crypto.randomUUID();
    setBusy(true);
    setPrompt("");
    setMessages([...history, { role: "assistant", content: "" }]);
    let unsubscribe: UnlistenFn | undefined;
    try {
      unsubscribe = await listen<Delta>("hts:plan-delta", event => {
        if (event.payload.runId !== request) return;
        setMessages(current => current.map((message, index) =>
          index === current.length - 1 && message.role === "assistant"
            ? { ...message, content: (message.content + event.payload.delta).slice(0, 200_000) }
            : message,
        ));
      });
      const result = await invoke<Reply>("chatgpt_plan_message", {
        runId: request,
        model: selected,
        turns: history,
      });
      setMessages([...history, { role: "assistant", content: result.text || "(Réponse vide)" }]);
    } catch (error) {
      setMessages(messages);
      setPrompt(text);
      toast.error(String(error));
    } finally {
      unsubscribe?.();
      setBusy(false);
    }
  }

  return (
    <Card className="xl:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4" /> ChatGPT plan · Responses API</CardTitle>
        <CardDescription>Connexion OpenAI officielle, modèles de ton compte et réponses sans clé API payante. Les quotas de ton forfait s'appliquent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.connected && <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0" />
          {status.account || "Compte ChatGPT connecté"} · {status.planEnabled ? "Forfait autorisé" : "Autorisation du forfait absente"}
        </p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={loginPending || busy} onClick={() => void signIn()}>
            {loginPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
            {loginPending ? "Connexion…" : status.connected ? "Reconnecter ChatGPT" : "Continuer avec ChatGPT"}
          </Button>
          {status.connected && <Button size="sm" variant="outline" disabled={loginPending || busy} onClick={() => void signOut()}>
            <LogOut className="mr-2 size-4" /> Déconnexion
          </Button>}
        </div>
        {status.planEnabled && <>
          <label className="text-xs font-medium" htmlFor="plan-model">Modèle ChatGPT autorisé</label>
          <select id="plan-model" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selected} disabled={modelsPending || busy}
            onChange={event => { setSelected(event.target.value); setMessages([]); }}>
            {modelsPending && <option value="">Chargement…</option>}
            {!modelsPending && models.length === 0 && <option value="">Aucun modèle disponible</option>}
            {models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
          <div aria-label="Historique ChatGPT direct" role="log" className="max-h-64 space-y-2 overflow-y-auto rounded-md border bg-muted/10 p-3 text-sm">
            {messages.length === 0 && <p className="text-muted-foreground">Aucune discussion dans cette session.</p>}
            {messages.map((message, index) => (
              <div key={index} className={`rounded-md p-2 whitespace-pre-wrap break-words ${message.role === "user" ? "bg-primary/10" : "bg-muted/30"}`}>
                <span className="mb-1 block text-xs font-semibold">{message.role === "user" ? "Vous" : "ChatGPT"}</span>
                {message.content || (busy ? "Génération…" : "")}
              </div>
            ))}
          </div>
          <label htmlFor="plan-prompt" className="text-xs font-medium">Votre message</label>
          <Textarea id="plan-prompt" rows={2} value={prompt} onChange={event => setPrompt(event.target.value)}
            disabled={busy || !selected} maxLength={8000} placeholder="Une question pour ChatGPT…" />
          <Button size="sm" disabled={busy || !selected || !prompt.trim()} onClick={() => void send()}>
            {busy ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
            {busy ? "Réponse en cours…" : "Envoyer"}
          </Button>
        </>}
        <p className="text-xs text-muted-foreground">
          Aucun appel à backend-api privé. Chaque réponse utilise <code>store=false</code> et <code>stream=true</code>.
          Les jetons restent côté Rust dans le coffre Windows.
        </p>
        <Button size="sm" variant="ghost" onClick={() => void openUrl("https://developers.openai.com/siwc/token-sharing-open-source")}>
          Documentation officielle <ExternalLink className="ml-2 size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
