import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HelloEffect from "./hello-effect";
import WelcomeCommitButton from "./welcome-commit-button";

type StartupWelcomeProps = { onDismiss: () => void; onEnter?: () => void };

/** One-time handwritten greeting, with an explicit accessible entry action. */
export default function StartupWelcome({ onDismiss, onEnter }: StartupWelcomeProps) {
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const completeIntroduction = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (ready) startButtonRef.current?.focus();
    else skipButtonRef.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDismiss, 690);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !ready) {
        event.preventDefault();
        completeIntroduction();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completeIntroduction, ready]);

  const startApplication = () => {
    if (leaving) return;
    onEnter?.();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) onDismiss();
    else setLeaving(true);
  };

  return (
    <div className="hts-welcome-screen" data-leaving={leaving ? "true" : undefined}
      role="dialog" aria-modal="true" aria-labelledby="hts-welcome-title">
      <div className="hts-welcome-inner">
        <span className="hts-welcome-eyebrow">HébergTonServ Desktop</span>
        <HelloEffect onComplete={completeIntroduction} speed={1} />
        <h2 id="hts-welcome-title" className="hts-welcome-title">Bienvenue dans votre espace</h2>
        <p className="hts-welcome-subtitle">Vos serveurs, clés SSH et connexions réunis au même endroit.</p>
        <p className="hts-welcome-status" role="status" aria-live="polite">
          {ready ? "Votre espace est prêt." : "Une bienvenue rien que pour vous…"}
        </p>
        {ready && <>
          <WelcomeCommitButton buttonRef={startButtonRef} onCommit={startApplication} disabled={leaving} />
          <p className="hts-welcome-hint">Cliquez ou glissez la flèche pour ouvrir</p>
        </>}
      </div>
      {!ready && <Button ref={skipButtonRef} variant="ghost" className="hts-welcome-skip" onClick={completeIntroduction} type="button">
        Passer l’introduction <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>}
    </div>
  );
}
