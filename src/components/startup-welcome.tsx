import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HelloEffect from "./hello-effect";

type StartupWelcomeProps = { onDismiss: () => void };

/**
 * A one-time handwritten greeting, never a fake progress indicator.
 * The user chooses when to enter the app after the last pen stroke.
 */
export default function StartupWelcome({ onDismiss }: StartupWelcomeProps) {
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
    const timer = window.setTimeout(onDismiss, 240);
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
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDismiss();
    } else {
      setLeaving(true);
    }
  };

  return (
    <div
      className="hts-welcome-screen"
      data-leaving={leaving ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hts-welcome-title"
    >
      <div className="hts-welcome-inner">
        <span className="hts-welcome-eyebrow">HébergTonServ Desktop</span>
        <HelloEffect onComplete={completeIntroduction} speed={1} />
        <h2 id="hts-welcome-title" className="hts-welcome-title">Bienvenue dans votre espace</h2>
        <p className="hts-welcome-subtitle">
          Vos serveurs, clés SSH et connexions réunis au même endroit.
        </p>
        <p className="hts-welcome-status" role="status" aria-live="polite">
          {ready ? "Votre espace est prêt." : "Une bienvenue rien que pour vous…"}
        </p>
        {ready && (
          <Button
            ref={startButtonRef}
            variant="default"
            size="lg"
            className="hts-welcome-start"
            onClick={startApplication}
            disabled={leaving}
            type="button"
          >
            Démarrer <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {!ready && (
        <Button
          ref={skipButtonRef}
          variant="ghost"
          className="hts-welcome-skip"
          onClick={completeIntroduction}
          type="button"
        >
          Passer l’introduction <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
