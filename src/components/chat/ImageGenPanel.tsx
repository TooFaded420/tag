/**
 * ImageGenPanel — collapsible sidebar image generation panel via fal.ai
 *
 * Allows users to generate images with FLUX Schnell (free) or FLUX Pro v1.1 (pro).
 * Recent images are fetched on mount and after each generation. Clicking an image
 * opens a fullscreen overlay; hovering shows prompt + copy button.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Image, Loader2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/tag-image-gen`;

// ── Types ─────────────────────────────────────────────────────────────────────

type Model = "fal-ai/flux/schnell" | "fal-ai/flux-pro/v1.1";

interface HistoryImage {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  created_at: string;
}

interface GenerateResult {
  image_url: string;
  prompt: string;
  model: string;
  created_at: string;
}

// ── Model options ─────────────────────────────────────────────────────────────

const MODEL_OPTIONS: { value: Model; label: string; badge: string; proOnly: boolean }[] = [
  { value: "fal-ai/flux/schnell", label: "FLUX Schnell", badge: "Free", proOnly: false },
  { value: "fal-ai/flux-pro/v1.1", label: "FLUX Pro v1.1", badge: "Pro", proOnly: true },
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGenerate(jwt: string, prompt: string, model: Model): Promise<GenerateResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ action: "generate", prompt, model }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as GenerateResult;
}

async function apiList(jwt: string): Promise<HistoryImage[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ action: "list" }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.images as HistoryImage[]) ?? [];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ImageGenPanelProps {
  jwt: string | null;
}

export function ImageGenPanel({ jwt }: ImageGenPanelProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<Model>("fal-ai/flux/schnell");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<HistoryImage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fullscreen, setFullscreen] = useState<HistoryImage | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadHistory = useCallback(async () => {
    if (!jwt) return;
    setLoadingHistory(true);
    try {
      const list = await apiList(jwt);
      setImages(list);
    } finally {
      setLoadingHistory(false);
    }
  }, [jwt]);

  useEffect(() => {
    if (open && jwt) {
      loadHistory();
    }
  }, [open, jwt, loadHistory]);

  if (!jwt) return null;

  const promptLen = prompt.length;
  const promptValid = promptLen > 0 && promptLen <= 500;

  async function handleGenerate() {
    if (!jwt || !promptValid || generating) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await apiGenerate(jwt, prompt, model);
      const newImg: HistoryImage = {
        id: crypto.randomUUID(),
        prompt: result.prompt,
        model: result.model,
        image_url: result.image_url,
        created_at: result.created_at,
      };
      setImages((prev) => [newImg, ...prev]);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyPrompt(p: string, id: string) {
    navigator.clipboard.writeText(p).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied((prev) => (prev === id ? null : prev)), 1500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  return (
    <>
      {/* ── Panel ── */}
      <div className="border border-border/40 rounded-lg overflow-hidden bg-card/40">
        {/* Header */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/20 transition-colors"
          aria-expanded={open}
        >
          <Image className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground/80 flex-1">Images</span>
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {open && (
          <div className="px-3 pb-3 flex flex-col gap-3 border-t border-border/30">
            {/* Prompt textarea */}
            <div className="pt-3 flex flex-col gap-1.5">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image…"
                rows={3}
                maxLength={500}
                className={cn(
                  "w-full resize-none rounded-md border bg-background px-2.5 py-2 text-xs",
                  "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1",
                  "focus:ring-ring transition-colors",
                  promptLen > 500
                    ? "border-destructive focus:ring-destructive"
                    : "border-border/60",
                )}
              />
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    promptLen > 480
                      ? promptLen > 500
                        ? "text-destructive"
                        : "text-amber-500"
                      : "text-muted-foreground/50",
                  )}
                >
                  {promptLen}/500
                </span>
              </div>
            </div>

            {/* Model picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Model
              </label>
              <div className="flex gap-1.5">
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setModel(opt.value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-[10px] transition-colors",
                      model === opt.value
                        ? "border-foreground/40 bg-accent/30 text-foreground"
                        : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground/80",
                    )}
                  >
                    <span className="font-medium leading-tight">{opt.label}</span>
                    <span
                      className={cn(
                        "px-1 py-px rounded text-[9px] font-semibold leading-tight",
                        opt.proOnly
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                      )}
                    >
                      {opt.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[11px] text-destructive leading-snug rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2">
                {error}
              </p>
            )}

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!promptValid || generating}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-all",
                "bg-foreground text-background hover:opacity-90 active:opacity-80",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  Generate
                  <span className="text-background/50 text-[10px]">⌘↵</span>
                </>
              )}
            </button>

            {/* Recent images grid */}
            {loadingHistory && images.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : images.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Recent
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {images.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-md overflow-hidden bg-muted/40">
                      <img
                        src={img.image_url}
                        alt={img.prompt}
                        loading="lazy"
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                        onClick={() => setFullscreen(img)}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5 pointer-events-none group-hover:pointer-events-auto">
                        <p className="text-white text-[9px] leading-tight line-clamp-2 mb-1">
                          {img.prompt}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleCopyPrompt(img.prompt, img.id); }}
                          className="flex items-center gap-1 text-white/80 hover:text-white text-[9px] self-start"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          {copied === img.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Fullscreen overlay ── */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFullscreen(null)}
        >
          <div
            className="relative max-w-3xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFullscreen(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
              aria-label="Close fullscreen"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={fullscreen.image_url}
              alt={fullscreen.prompt}
              className="w-full rounded-xl shadow-2xl object-contain max-h-[75vh]"
            />
            <div className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
              <p className="text-white/80 text-xs leading-snug flex-1">{fullscreen.prompt}</p>
              <button
                type="button"
                onClick={() => handleCopyPrompt(fullscreen.prompt, fullscreen.id + "-fs")}
                className="shrink-0 text-white/50 hover:text-white transition-colors mt-0.5"
                aria-label="Copy prompt"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
