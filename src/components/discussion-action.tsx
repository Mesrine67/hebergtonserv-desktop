import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LifeBuoy, MessageCircle, Plus, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller, MessageScrollerButton, MessageScrollerContent,
  MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DISCUSSION_MAX_LENGTH, DISCUSSION_MAX_MESSAGES, helpReply,
  persistDiscussion, readDiscussion, type DiscussionMessage,
} from "@/lib/discussion";
import "./discussion-panel.css";

const quickQuestions = [
  "Vérifier les mises à jour",
  "Configurer une clé SSH",
  "Ajouter un panel",
  "Changer le thème",
];

function formatTime(value: string): string {
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return "";
  }
}

function readInitial(): DiscussionMessage[] {
  if (typeof window === "undefined") return [];
  return readDiscussion(window.localStorage);
}

export function DiscussionAction() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DiscussionMessage[]>(readInitial);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function send(value = draft) {
    const content = value.trim();
    if (!content || content.length > DISCUSSION_MAX_LENGTH) return;
    const now = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const next: DiscussionMessage[] = [
      ...messages,
      { id: `${id}-user`, role: "user" as const, content, createdAt: now },
      { id: `${id}-help`, role: "help" as const, content: helpReply(content), createdAt: now },
    ].slice(-DISCUSSION_MAX_MESSAGES);
    setMessages(next);
    persistDiscussion(window.localStorage, next);
    setDraft("");
    textareaRef.current?.focus();
  }

  function clear() {
    setMessages([]);
    persistDiscussion(window.localStorage, []);
    setDraft("");
    textareaRef.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function inputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="size-8 shrink-0"
              aria-label="Ouvrir la discussion" aria-expanded={open}>
              <MessageCircle className="size-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Discussion</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end" side="bottom" sideOffset={8} collisionPadding={8}
        onOpenAutoFocus={(event) => { event.preventDefault(); textareaRef.current?.focus(); }}
        className="hts-discussion-panel z-[10010] w-[min(420px,calc(100vw-24px))] overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-2xl ring-0"
        aria-label="Discussion HébergTonServ"
      >
        <section className="flex h-full min-h-0 flex-col" aria-label="Aide et discussion locale">
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/70 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <MessageCircle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Discussion</h2>
              <p className="text-[11px] text-muted-foreground">Aide locale · sans connexion à une IA</p>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" className="size-7"
              onClick={clear} disabled={messages.length === 0} aria-label="Nouvelle discussion" title="Nouvelle discussion">
              <Plus className="size-4" />
            </Button>
          </header>
          <div className="min-h-0 flex-1">
            <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent className="gap-3 px-3 py-4">
                    <MessageScrollerItem messageId="discussion-intro">
                      <Message className="gap-2">
                        <MessageAvatar className="size-7 min-w-7 bg-primary/10 text-primary">
                          <LifeBuoy className="size-3.5" aria-hidden="true" />
                        </MessageAvatar>
                        <MessageContent className="gap-1">
                          <MessageHeader>Aide HébergTonServ</MessageHeader>
                          <Bubble variant="secondary" className="max-w-[95%]">
                            <BubbleContent className="px-3 py-2 leading-relaxed">
                              Bonjour ! Je peux vous guider dans l’application. Choisissez un sujet ou écrivez une question.
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                    {messages.map((message) => (
                      <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                        <Message align={message.role === "user" ? "end" : "start"} className="gap-2">
                          {message.role === "help" && (
                            <MessageAvatar className="size-7 min-w-7 bg-primary/10 text-primary">
                              <LifeBuoy className="size-3.5" aria-hidden="true" />
                            </MessageAvatar>
                          )}
                          <MessageContent className="gap-1">
                            <MessageHeader>{message.role === "user" ? "Vous" : "Aide locale"}</MessageHeader>
                            <Bubble align={message.role === "user" ? "end" : "start"}
                              variant={message.role === "user" ? "default" : "secondary"}
                              className="max-w-[94%]">
                              <BubbleContent className="whitespace-pre-wrap px-3 py-2 leading-relaxed">{message.content}</BubbleContent>
                            </Bubble>
                            <MessageFooter>{formatTime(message.createdAt)}</MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>
          <div className="shrink-0 border-t border-border bg-popover px-3 pb-3 pt-2.5">
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Questions rapides">
              {quickQuestions.map((question) => (
                <Button type="button" key={question} variant="outline" size="xs"
                  className="h-6 max-w-full bg-card/60 px-2 text-[10px] text-muted-foreground"
                  onClick={() => send(question)}>{question}</Button>
              ))}
            </div>
            <form onSubmit={submit} aria-label="Envoyer un message">
              <InputGroup className="min-h-20 overflow-hidden rounded-lg bg-card/60">
                <InputGroupTextarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={inputKeyDown} maxLength={DISCUSSION_MAX_LENGTH}
                  rows={2} placeholder="Écrire un message…" aria-label="Votre message"
                  className="max-h-28 min-h-11 resize-none px-3 py-2 text-xs" />
                <InputGroupAddon align="block-end" className="justify-between px-2 pb-1.5 pt-0">
                  <span className="text-[10px] text-muted-foreground">Entrée : envoyer · Maj + Entrée : ligne</span>
                  <InputGroupButton type="submit" variant="default" size="icon-sm"
                    disabled={!draft.trim()} aria-label="Envoyer le message" title="Envoyer">
                    <Send className="size-3.5" />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              Messages enregistrés uniquement sur ce PC. Ne saisissez jamais de mots de passe ni de clés privées.
            </p>
          </div>
        </section>
      </PopoverContent>
    </Popover>
  );
}
