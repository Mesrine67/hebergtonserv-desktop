import { useCallback, useEffect, useRef, useState } from "react";
import HelloEffect from "./hello-effect";

type StartupWelcomeProps = {
  onDismiss: () => void;
};

/**
 * The handwriting is an introduction, not a navigation timer.
 * It reveals a confirmation button; only an intentional click enters the app.
 */
export default function StartupWelcome({ onDismiss }: StartupWelcomeProps) {
  const [ready, setReady] = useState(false);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const completeIntroduction = useCallback(() => setReady(true), []);

  useEffect(() => {
    // The welcome screen is modal: give keyboard users a predictable entry point.
    if (ready) startButtonRef.current?.focus();
    else skipButtonRef.current?.focus();
  }, [ready]);

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

  return (
    <div className="hts-welcome-screen" role="dialog" aria-modal="true" aria-labelledby="hts-welcome-title">
      <div className="hts-welcome-inner">
        <div className="hts-welcome-eyebrow">HébergTonServ Desktop</div>
        <HelloEffect onComplete={completeIntroduction} speed={0.72} />
        <h2 id="hts-welcome-title" className="hts-welcome-title">Bienvenue dans votre espace</h2>
        <p className="hts-welcome-subtitle">Vos serveurs, clés SSH et connexions réunis au même endroit.</p>
        <div className="hts-welcome-progress" aria-hidden="true">
          <div className={`hts-welcome-progress-fill${ready ? " is-complete" : ""}`} />
        </div>
        <p className="hts-welcome-status" role="status" aria-live="polite">
          {ready ? "Votre espace est prêt. Cliquez sur Démarrer pour continuer." : "Présentation de votre espace…"}
        </p>
      </div>
      {ready ? (
        <button
          ref={startButtonRef}
          className="hts-welcome-start"
          onClick={onDismiss}
          type="button"
        >
          Démarrer <span aria-hidden="true">→</span>
        </button>
      ) : (
        <button
          ref={skipButtonRef}
          className="hts-welcome-skip"
          onClick={completeIntroduction}
          type="button"
        >
          Passer l’introduction <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
