import { useRef, useState, type Ref } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { onCommit: () => void; disabled?: boolean; buttonRef?: Ref<HTMLButtonElement> };

/** Uses the app's shadcn primary button and theme tokens, not a separate slider UI. */
export default function WelcomeCommitButton({ onCommit, disabled = false, buttonRef }: Props) {
  const committedRef = useRef(false);
  const [committed, setCommitted] = useState(false);
  const start = () => {
    if (disabled || committedRef.current) return;
    committedRef.current = true;
    setCommitted(true);
    onCommit();
  };

  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="default"
      size="lg"
      className="hts-welcome-start hts-start-primary"
      aria-label="Démarrer HébergTonServ"
      disabled={disabled || committed}
      data-committed={committed ? "true" : undefined}
      onClick={start}
    >
      <span>{committed ? "Ouverture…" : "Démarrer"}</span>
      {committed ? <Check className="size-4" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
    </Button>
  );
}
