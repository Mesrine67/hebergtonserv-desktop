import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

type NavigationControls = {
  canBack: boolean;
  canForward: boolean;
  back: () => void;
  forward: () => void;
};
const Context = createContext<NavigationControls | null>(null);

export function readBrowserHistoryIndex(value: unknown): number {
  if (typeof value !== "object" || value === null || !("idx" in value)) return 0;
  const idx = value.idx;
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : 0;
}

export function WorkspaceNavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [position, setPosition] = useState(() => readBrowserHistoryIndex(window.history.state));
  const [lastKnown, setLastKnown] = useState(() => readBrowserHistoryIndex(window.history.state));

  useEffect(() => {
    const next = readBrowserHistoryIndex(window.history.state);
    setPosition(next);
    if (navigationType === "PUSH") setLastKnown(next);
  }, [location.key, navigationType]);

  const back = useCallback(() => { if (position > 0) navigate(-1); }, [navigate, position]);
  const forward = useCallback(() => { if (position < lastKnown) navigate(1); }, [navigate, position, lastKnown]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || !event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" && position > 0) { event.preventDefault(); navigate(-1); }
      if (event.key === "ArrowRight" && position < lastKnown) { event.preventDefault(); navigate(1); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [navigate, position, lastKnown]);

  const value = useMemo(() => ({ canBack: position > 0, canForward: position < lastKnown, back, forward }), [position, lastKnown, back, forward]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspaceNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("Navigation must be used inside WorkspaceNavigationProvider");
  return value;
}
