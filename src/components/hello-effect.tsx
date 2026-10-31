import { useCallback, useEffect, useRef } from "react";
import "./hello-effect.css";

interface HelloEffectProps {
  onComplete: () => void;
  speed?: number;
}

// Independent pen strokes. CSS animates their normalized path lengths,
// so the handwriting never depends on timers or an animation library.
const strokes = [
  "M 45 126 C 57 91 67 53 78 27 C 85 11 95 12 98 27 C 103 47 75 97 79 120 C 83 139 97 112 108 96 C 126 70 143 89 137 107 C 132 124 131 134 148 117",
  "M 150 116 C 160 119 177 110 187 96 C 200 76 182 77 174 86 C 163 98 160 124 179 130 C 191 134 204 122 214 111",
  "M 214 111 C 234 88 252 45 255 22 C 257 6 245 9 237 28 C 224 64 215 112 228 125 C 239 137 250 121 260 113",
  "M 260 113 C 281 83 297 38 299 20 C 301 6 290 10 283 30 C 269 70 262 117 276 126 C 288 135 298 121 309 111",
  "M 310 110 C 317 90 332 82 348 88 C 366 96 360 119 347 128 C 331 139 309 130 310 110 C 311 93 338 78 357 93 C 367 104 371 119 391 116",
];

export default function HelloEffect({ onComplete, speed = 1 }: HelloEffectProps) {
  const completed = useRef(false);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (query?.matches) {
      finish();
      return;
    }
    // WebView can pause or suppress CSS animation events. Never trap users
    // behind the welcome screen if its final animation event is missed.
    const durationMs = (((strokes.length - 1) * 0.29 + 0.7) / speed) * 1000 + 700;
    const timeout = window.setTimeout(finish, durationMs);
    return () => window.clearTimeout(timeout);
  }, [finish, speed]);

  return (
    <svg
      className="hts-hello-writing"
      viewBox="0 0 440 160"
      role="img"
      aria-label="Hello"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="hello-writing"
    >
      {strokes.map((path, index) => (
        <path
          key={index}
          d={path}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            ["--hello-stroke-delay" as string]: `${(index * 0.29) / speed}s`,
            ["--hello-stroke-duration" as string]: `${0.7 / speed}s`,
          }}
          onAnimationEnd={index === strokes.length - 1 ? finish : undefined}
        />
      ))}
    </svg>
  );
}
