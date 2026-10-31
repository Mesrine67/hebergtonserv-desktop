import { useEffect, useRef } from "react";
import HelloEffect from "./hello-effect";

type StartupWelcomeProps = {
  onDismiss: () => void;
};

export default function StartupWelcome({ onDismiss }: StartupWelcomeProps) {
  const skipButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Keyboard users can skip without navigating through the obscured app.
    skipButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div className="hts-welcome-screen" role="dialog" aria-modal="true" aria-label="Bienvenue sur HébergTonServ Desktop">
      <div className="hts-welcome-inner">
        <div className="hts-welcome-eyebrow">HébergTonServ Desktop</div>
        <HelloEffect onComplete={onDismiss} speed={1.5} />
        <h2 className="hts-welcome-title">Bienvenue dans votre espace</h2>
        <p className="hts-welcome-subtitle">Vos serveurs, clés SSH et connexions réunis au même endroit.</p>
      </div>
      <button ref={skipButtonRef} className="hts-welcome-skip" onClick={onDismiss} type="button">
        Passer l’introduction <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
