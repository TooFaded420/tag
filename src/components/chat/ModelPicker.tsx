import { useEffect, useState } from "react";
import { Check, ChevronDown, ImageIcon, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface ModelOption {
  id: string;
  label: string;
  provider: "synthetic" | "byok";
  tier: "anon" | "free" | "pro" | "byok";
  description: string;
  pricing?: string;
  /** "text" (default) or "image" — determines send path and composer placeholder */
  modality?: "text" | "image";
}

export const MODELS: ModelOption[] = [
  {
    id: "hf:openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "synthetic",
    tier: "anon",
    description: "OpenAI's open-source 120B. Fast and capable.",
    pricing: "$0.10/M in & out",
  },
  {
    id: "hf:zai-org/GLM-4.7-Flash",
    label: "GLM 4.7 Flash",
    provider: "synthetic",
    tier: "free",
    description: "Fast 30B model. Cheap and reliable.",
    pricing: "$0.10/M in, $0.50/M out",
  },
  {
    id: "hf:moonshotai/Kimi-K2.6",
    label: "Kimi K2.6",
    provider: "synthetic",
    tier: "pro",
    description: "Opus 4.6 class. 256k context. Reasoning model.",
    pricing: "$0.95/M in, $4.00/M out",
  },
  {
    id: "hf:zai-org/GLM-5.1",
    label: "GLM 5.1",
    provider: "synthetic",
    tier: "pro",
    description: "Massive coding + agentic model. 202k context.",
    pricing: "$1.00/M in, $3.00/M out",
  },
  {
    id: "hf:MiniMaxAI/MiniMax-M2.5",
    label: "MiniMax M2.5",
    provider: "synthetic",
    tier: "pro",
    description: "Agentic + office work. Fast.",
    pricing: "$0.40/M in, $2.00/M out",
  },
  {
    id: "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
    label: "Nemotron 3 Super 120B",
    provider: "synthetic",
    tier: "pro",
    description: "Nvidia 120B for coding agents. 262k context.",
    pricing: "$0.30/M in, $1.00/M out",
  },
  {
    id: "hf:Qwen/Qwen3.2-72B-Instruct",
    label: "Qwen 3.2 72B",
    provider: "synthetic",
    tier: "pro",
    description: "Qwen 3.2 72B Instruct. Balanced performance. 32k context. Pro only.",
    pricing: "$0.40/M in, $0.80/M out",
  },
  {
    id: "hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct",
    label: "Llama 4 Maverick",
    provider: "synthetic",
    tier: "pro",
    description: "Meta Llama 4 Maverick MoE. 128k context. Premium.",
    pricing: "$0.60/M in, $1.20/M out",
  },
  {
    id: "hf:deepseek-ai/DeepSeek-V3.5",
    label: "DeepSeek V3.5",
    provider: "synthetic",
    tier: "pro",
    description: "DeepSeek V3.5. Strong coding + reasoning. 64k context. Pro only.",
    pricing: "$0.30/M in, $0.60/M out",
  },
  {
    id: "hf:mistralai/Mistral-Large-2.4",
    label: "Mistral Large 2.4",
    provider: "synthetic",
    tier: "pro",
    description: "Mistral Large 2.4. Strong multilingual + instruction. 128k context.",
    pricing: "$0.80/M in, $2.40/M out",
  },
  // Image models — fal.ai FLUX (wired in synthetic-image-proxy v2)
  {
    id: "fal:flux/schnell",
    label: "FLUX Schnell",
    provider: "synthetic",
    tier: "anon",
    description: "Fast FLUX image generation. Free tier.",
    pricing: "Free",
    modality: "image",
  },
  {
    id: "fal:flux/pro",
    label: "FLUX Pro",
    provider: "synthetic",
    tier: "pro",
    description: "High-quality FLUX Pro image generation.",
    pricing: "Pro",
    modality: "image",
  },
];

type Tier = "anon" | "free" | "pro";

interface Props {
  value: string;
  onChange: (modelId: string) => void;
  onUpgrade?: () => void;
  /** When provided by the parent (Chat.tsx), used directly — no internal auth subscription. */
  tier?: "free" | "pro";
}

export function ModelPicker({ value, onChange, onUpgrade, tier: tierProp }: Props) {
  // Internal tier state is only used when the parent does not pass `tier`.
  // Chat.tsx always passes it, so the subscription below is a dead path in that context.
  const [tierInternal, setTierInternal] = useState<Tier>("anon");
  const tier: Tier = tierProp ?? tierInternal;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Skip internal auth subscription when parent supplies tier directly.
    if (tierProp !== undefined) return;

    let mounted = true;

    const loadTier = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.id) {
        if (mounted) setTierInternal("anon");
        return;
      }
      try {
        // TODO: Update types after profiles.tier migration applied
        const { data } = await (supabase as any)
          .from("profiles")
          .select("tier")
          .eq("id", session.session.user.id)
          .maybeSingle();
        if (mounted) setTierInternal(((data as any)?.tier ?? "free") as Tier);
      } catch {
        if (mounted) setTierInternal("free");
      }
    };

    loadTier();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadTier());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [tierProp]);

  const selectedModel = MODELS.find((m) => m.id === value) ?? MODELS[0];

  const isModelAllowed = (model: ModelOption): boolean => {
    if (model.tier === "anon") return true;
    if (model.tier === "free") return tier === "free" || tier === "pro";
    if (model.tier === "pro") return tier === "pro";
    return false;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        <span className="font-medium">{selectedModel.label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-card shadow-lg">
            <div className="p-2 max-h-96 overflow-y-auto">
              {MODELS.map((model) => {
                const allowed = isModelAllowed(model);
                const isSelected = model.id === value;
                return (
                  <button
                    key={model.id}
                    type="button"
                    disabled={!allowed}
                    onClick={() => {
                      if (allowed) {
                        onChange(model.id);
                        setOpen(false);
                      }
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors",
                      allowed
                        ? "hover:bg-muted cursor-pointer"
                        : "opacity-50 cursor-not-allowed",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {model.modality === "image" && (
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-medium text-sm">{model.label}</span>
                          {model.tier === "pro" && (
                            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                              Pro
                            </span>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {model.description}
                        </p>
                        {model.pricing && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                            {model.pricing}
                          </p>
                        )}
                      </div>
                      {!allowed && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {tier !== "pro" && (
              <div className="border-t border-border p-3">
                <button
                  type="button"
                  onClick={() => onUpgrade?.()}
                  className="block w-full text-center text-xs text-primary hover:underline"
                >
                  Upgrade to Pro for premium models →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
