import { useCallback, useEffect, useRef } from "react";
import "./hello-effect.css";

interface HelloEffectProps {
  onComplete: () => void;
  speed?: number;
}

/** Animated brand wordmark without blocking the UI thread or importing a font. */
export default function HelloEffect({ onComplete, speed = 1 }: HelloEffectProps) {
  const finished = useRef(false);
  const complete = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      complete();
      return;
    }
    const timeout = window.setTimeout(complete, 2450 / speed);
    return () => window.clearTimeout(timeout);
  }, [complete, speed]);

  return (
    <div
      className="hts-brand-writing"
      role="img"
      aria-label="HébergTonServ"
      data-testid="hello-writing"
      style={{ ["--brand-speed" as string]: String(speed) }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) complete();
      }}
    >
      <span className="hts-brand-writing-text">HébergTonServ</span>
      <span className="hts-brand-writing-glow" aria-hidden="true">HébergTonServ</span>
    </div>
  );
}
