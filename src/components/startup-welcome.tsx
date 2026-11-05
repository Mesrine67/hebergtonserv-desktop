import { useCallback, useEffect, useRef, useState } from "react";
import HelloEffect from "./hello-effect";
import WelcomeCommitButton from "./welcome-commit-button";

type StartupWelcomeProps = { onDismiss: () => void; onEnter?: () => void; startAnimation?: boolean };

/** Handwritten brand introduction followed by one explicit, themed entry action. */
export default function StartupWelcome({ onDismiss, onEnter, startAnimation = true }: StartupWelcomeProps) {
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const completeIntroduction = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (ready) startButtonRef.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDismiss, 690);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss]);

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
        <HelloEffect onComplete={completeIntroduction} speed={1} play={startAnimation} />
        <h2 id="hts-welcome-title" className="hts-welcome-title">Bienvenue dans votre espace</h2>
        <p className="hts-welcome-subtitle">Vos serveurs, clés SSH et connexions réunis au même endroit.</p>
        <p className="hts-welcome-status" role="status" aria-live="polite">
          {ready ? "Votre espace est prêt." : "Bienvenue sur HébergTonServ…"}
        </p>
        <div className="hts-welcome-actions">
          {ready && (
            <>
              <WelcomeCommitButton buttonRef={startButtonRef} onCommit={startApplication} disabled={leaving} />
              <p className="hts-welcome-hint">Accéder à votre espace de gestion</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
