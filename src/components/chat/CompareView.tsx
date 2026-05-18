import { useState } from "react";
import { Crown, Send, ChevronDown, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS, type ModelOption } from "@/components/chat/ModelPicker";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/synthetic-public-proxy`;

// Default 3 models for compare: one anon-accessible, one free, one pro
const DEFAULT_COMPARE_MODELS = [
  "hf:openai/gpt-oss-120b",
  "hf:zai-org/GLM-4.7-Flash",
  "hf:moonshotai/Kimi-K2.6",
];

interface ModelResponseState {
  text: string;
  loading: boolean;
  error: string | null;
}

interface Props {
  jwt: string | null;
  tier: "free" | "pro";
  byokKeys: Record<string, string> | undefined;
  onUpgrade: () => void;
}

// Inline model chip selector for swapping a slot's model
function SlotModelChip({
  modelId,
  onSwap,
  tier,
  onUpgrade,
}: {
  modelId: string;
  onSwap: (newId: string) => void;
  tier: "free" | "pro";
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
      >
        {model.label}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-card shadow-lg">
            <div className="p-1.5 max-h-72 overflow-y-auto">
              {MODELS.map((m) => {
                const isSelected = m.id === modelId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.tier === "pro" && tier !== "pro") {
                        setOpen(false);
                        onUpgrade();
                        return;
                      }
                      onSwap(m.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-md transition-colors hover:bg-muted",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{m.label}</span>
                          {m.tier === "pro" && (
                            <span className="text-[9px] uppercase tracking-wider text-primary font-semibold">
                              Pro
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {m.description}
                        </p>
                      </div>
                      {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                      {m.tier === "pro" && (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

async function fetchModelResponse(
  prompt: string,
  modelId: string,
  jwt: string | null,
  byokKeys: Record<string, string> | undefined
): Promise<string> {
  // BYOK keys NEVER touch our server. If user has a synthetic key for an hf:
  // model, fetch direct to api.synthetic.new. Anything else routes through
  // the proxy WITHOUT the key — proxy uses its own SYNTHETIC_API_KEY (counted
  // against tier quota). This matches the Chat.tsx fetch wrapper pattern and
  // the product principle in the launch blog post.
  const syntheticKey = byokKeys?.["synthetic"];
  const useDirectBYOK = !!(modelId.startsWith("hf:") && syntheticKey);

  let res: Response;
  if (useDirectBYOK) {
    res = await fetch("https://api.synthetic.new/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${syntheticKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
  } else {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  }

  if (!res.ok) {
    let errMsg = "Request failed";
    try {
      const errData = await res.json();
      errMsg = errData?.error ?? errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function CompareView({ jwt, tier, byokKeys, onUpgrade }: Props) {
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_COMPARE_MODELS);
  const [prompt, setPrompt] = useState("");
  const [responses, setResponses] = useState<Record<string, ModelResponseState>>({});
  const [hasRun, setHasRun] = useState(false);

  // Pro gate
  if (tier !== "pro") {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="max-w-sm w-full rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Crown className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Pro Feature</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Compare up to 3 models side-by-side with a single prompt. Upgrade to unlock.
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Crown className="h-4 w-4" />
            Upgrade for $7/mo
          </button>
        </div>
      </div>
    );
  }

  function swapModel(slotIndex: number, newModelId: string) {
    setSelectedModels((prev) => {
      const next = [...prev];
      next[slotIndex] = newModelId;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setHasRun(true);

    // Initialize all slots as loading
    const initial: Record<string, ModelResponseState> = {};
    for (const modelId of selectedModels) {
      initial[modelId] = { text: "", loading: true, error: null };
    }
    setResponses(initial);

    // Fire all requests in parallel — failures in one slot don't break others
    const results = await Promise.allSettled(
      selectedModels.map((modelId) =>
        fetchModelResponse(trimmed, modelId, jwt, byokKeys)
      )
    );

    // Merge results back per model slot
    setResponses((prev) => {
      const next = { ...prev };
      selectedModels.forEach((modelId, i) => {
        const result = results[i];
        if (result.status === "fulfilled") {
          next[modelId] = { text: result.value, loading: false, error: null };
        } else {
          next[modelId] = {
            text: "",
            loading: false,
            error: (result.reason as Error)?.message ?? "Unknown error",
          };
        }
      });
      return next;
    });
  }

  const isLoading = Object.values(responses).some((r) => r.loading);

  const gridCols =
    selectedModels.length === 2
      ? "grid-cols-1 lg:grid-cols-2"
      : selectedModels.length === 4
        ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
        : "grid-cols-1 lg:grid-cols-3";

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Prompt input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 rounded-lg border border-border bg-card p-3"
      >
        <textarea
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="Send to all models at once…"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="rounded-md bg-primary p-2 text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Send to all models"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Column grid */}
      <div className={cn("grid gap-3", gridCols)}>
        {selectedModels.map((modelId, slotIndex) => {
          const state = responses[modelId];
          const modelMeta = MODELS.find((m) => m.id === modelId);

          return (
            <div
              key={`${slotIndex}-${modelId}`}
              className="flex flex-col rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Card header with model chip */}
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <SlotModelChip
                  modelId={modelId}
                  onSwap={(newId) => swapModel(slotIndex, newId)}
                  tier={tier}
                  onUpgrade={onUpgrade}
                />
                {modelMeta?.pricing && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                    {modelMeta.pricing}
                  </span>
                )}
              </div>

              {/* Response area */}
              <div className="flex-1 min-h-[200px] p-3">
                {!hasRun && (
                  <p className="text-xs text-muted-foreground/50 italic">
                    Response will appear here.
                  </p>
                )}
                {state?.loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="animate-pulse">Generating…</span>
                  </div>
                )}
                {state?.error && (
                  <p className="text-xs text-destructive">{state.error}</p>
                )}
                {state?.text && !state.loading && (
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {state.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
