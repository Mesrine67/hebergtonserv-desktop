import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import "./hello-effect.css";

type Stroke = { x: number; d: string; weight: number; accent?: boolean };

// Original monoline letterforms for the brand: the pen draws one SVG path at
// a time, with a small separate accent for é. No font or animation dependency.
const strokes: Stroke[] = [
  { x: 4, d: "M 12 121 C 16 103 23 73 31 48 C 34 37 39 39 37 51 C 35 68 27 95 27 113", weight: 1.4 },
  { x: 4, d: "M 66 120 C 65 103 70 73 78 49 C 81 40 85 41 83 50 C 79 66 73 96 73 116", weight: 1.3 },
  { x: 4, d: "M 27 85 C 41 89 59 88 75 82", weight: 0.7 },
  { x: 92, d: "M 7 99 C 19 101 40 90 38 80 C 35 66 16 74 11 87 C 2 109 18 122 38 108 C 43 104 47 99 50 95", weight: 1.4 },
  { x: 92, d: "M 23 63 C 28 57 34 53 39 48", weight: 0.42, accent: true },
  { x: 146, d: "M 11 114 C 14 99 23 63 24 50 C 25 37 17 39 17 55 C 16 74 10 96 11 111 C 12 121 17 113 22 103 C 29 87 42 83 47 93 C 57 111 37 125 20 113", weight: 1.7 },
  { x: 203, d: "M 7 99 C 20 102 39 91 38 81 C 35 68 17 74 11 87 C 2 108 17 122 36 109 C 42 104 46 99 49 96", weight: 1.35 },
  { x: 256, d: "M 8 116 C 14 106 16 91 16 83 C 16 76 11 81 11 87 C 10 95 12 102 19 101 C 25 90 32 84 42 86", weight: 0.98 },
  { x: 301, d: "M 45 80 C 31 71 17 79 12 94 C 7 111 23 122 37 111 C 46 103 48 90 45 80 C 46 94 40 120 37 135 C 34 153 18 156 15 146 C 13 137 28 130 46 127", weight: 1.8 },
  { x: 363, d: "M 6 59 C 25 42 58 43 76 49", weight: 1.0 },
  { x: 363, d: "M 50 47 C 45 68 36 100 32 118 C 29 132 40 128 53 110", weight: 1.15 },
  { x: 439, d: "M 40 84 C 32 76 17 80 11 93 C 4 111 18 125 34 115 C 47 107 50 91 40 84", weight: 1.35 },
  { x: 494, d: "M 9 116 C 12 105 16 90 16 81 C 16 77 13 86 17 94 C 25 83 40 81 43 90 C 46 98 37 114 45 117", weight: 1.28 },
  { x: 550, d: "M 67 53 C 55 40 38 40 23 53 C 6 68 15 76 34 83 C 51 90 48 106 35 115 C 24 124 11 123 10 115 C 10 110 15 106 21 107", weight: 1.7 },
  { x: 620, d: "M 7 99 C 20 102 39 91 38 81 C 35 68 17 74 11 87 C 2 108 17 122 36 109 C 42 104 46 99 49 96", weight: 1.35 },
  { x: 672, d: "M 8 116 C 14 106 16 91 16 83 C 16 76 11 81 11 87 C 10 95 12 102 19 101 C 25 90 32 84 42 86", weight: 0.98 },
  { x: 720, d: "M 7 84 C 11 101 14 116 23 116 C 32 115 43 89 47 83 C 51 77 48 98 43 110 C 39 119 45 118 54 112", weight: 1.25 },
];

const BASE_DURATION_MS = 3250;
const totalWeight = strokes.reduce((sum, stroke) => sum + stroke.weight, 0);

interface HelloEffectProps {
  onComplete: () => void;
  speed?: number;
  className?: string;
}

export default function HelloEffect({ onComplete, speed = 1, className = "" }: HelloEffectProps) {
  const finished = useRef(false);
  const playbackSpeed = Number.isFinite(speed) && speed > 0 ? Math.min(4, Math.max(0.4, speed)) : 1;
  const totalDuration = BASE_DURATION_MS / playbackSpeed;
  const frames = useMemo(() => {
    let elapsed = 0;
    return strokes.map((stroke, index) => {
      const duration = (stroke.weight / totalWeight) * totalDuration;
      const frame = { ...stroke, index, delay: elapsed, duration };
      elapsed += duration;
      return frame;
    });
  }, [totalDuration]);

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
    // Guard against WebView2 not firing animationend during a hidden cold start.
    // Normal completion follows the final drawn SVG path, not a fixed timer.
    const fallback = window.setTimeout(complete, totalDuration + 500);
    return () => window.clearTimeout(fallback);
  }, [complete, totalDuration]);

  return (
    <svg
      viewBox="0 0 787 165"
      className={("hts-hello-writing " + className).trim()}
      role="img"
      aria-label="HébergTonServ"
      data-slot="hello-effect"
      data-testid="hello-writing"
      preserveAspectRatio="xMidYMid meet"
      onAnimationEnd={(event) => {
        if ((event.target as Element).getAttribute("data-last") === "true") complete();
      }}
    >
      {frames.map((stroke) => (
        <path
          key={stroke.index}
          d={stroke.d}
          transform={"translate(" + stroke.x + " 0)"}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={5.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-accent={stroke.accent ? "true" : undefined}
          data-last={stroke.index === frames.length - 1 ? "true" : undefined}
          style={{
            "--hello-stroke-duration": String(stroke.duration) + "ms",
            "--hello-stroke-delay": String(stroke.delay) + "ms",
          } as CSSProperties}
        />
      ))}
    </svg>
  );
}
