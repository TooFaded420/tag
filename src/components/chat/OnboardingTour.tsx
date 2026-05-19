import { useCallback, useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";

const STORAGE_KEY = "tag_onboarding_completed";

interface OnboardingTourProps {
  userId: string | null;
  onOpenBYOK: () => void;
  onAddTemplate: (name: string, content: string) => void;
  onClose?: () => void;
}

const STEPS = [
  {
    title: "Welcome to Hecz",
    body: "An AI chat with real tools. Connect your accounts, save prompts, schedule recurring runs.",
    cta: "Get started →",
  },
  {
    title: "Bring your own key",
    body: "Hecz is free with anonymous limits. For unlimited usage, paste an Anthropic, Synthetic, or OpenAI key — it stays in your browser.",
    cta: "Open settings",
  },
  {
    title: "Skip the cold start",
    body: "Use templates to save your favorite prompts. Try `Summarize this in 3 bullets`.",
    cta: "Add it to my templates",
  },
];

export function OnboardingTour({ userId, onOpenBYOK, onAddTemplate, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // FIX 5: stable reference so keydown useEffect dep array is accurate.
  const complete = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setVisible(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        complete();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [complete]);

  function handleCTA() {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      onOpenBYOK();
      complete();
    } else if (step === 2) {
      onAddTemplate("Summarize", "Summarize this in 3 bullet points:\n\n");
      complete();
    }
  }

  function handleSkip() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      complete();
    }
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
      <div className="relative bg-background border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={complete}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close onboarding"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="pr-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCTA}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
          >
            {current.cta}
            {step === 0 && <ArrowRight size={14} />}
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Skip
            </button>
          )}
        </div>

        {/* Step dots */}
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === step ? "bg-foreground" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
