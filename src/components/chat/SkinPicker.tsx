/**
 * SkinPicker — theme/skin switcher for the Tag chat surface.
 * Persists to localStorage under key `tag_skin_v1`.
 * Four skins: paper | brick | editorial | canvas
 */

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type ChatSkin = "paper" | "brick" | "editorial" | "canvas";

const SKIN_KEY = "tag_skin_v1";

const SKINS: { id: ChatSkin; label: string; description: string; preview: string }[] = [
  {
    id: "paper",
    label: "Paper",
    description: "Clean cream, default",
    preview: "bg-[#FAF8F5]",
  },
  {
    id: "brick",
    label: "Brick",
    description: "Spray-painted wall",
    preview: "bg-[#C4A882]",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Vertical rotated mark",
    preview: "bg-[#F3F0EB]",
  },
  {
    id: "canvas",
    label: "Canvas",
    description: "Breathing watermark",
    preview: "bg-[#FAF8F5]",
  },
];

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatSkin(): [ChatSkin, (s: ChatSkin) => void] {
  const [skin, setSkinState] = useState<ChatSkin>(() => {
    try {
      const saved = localStorage.getItem(SKIN_KEY);
      if (saved === "paper" || saved === "brick" || saved === "editorial" || saved === "canvas") {
        return saved;
      }
    } catch {}
    return "paper";
  });

  const setSkin = (next: ChatSkin) => {
    setSkinState(next);
    try {
      localStorage.setItem(SKIN_KEY, next);
    } catch {}
  };

  return [skin, setSkin];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SkinPickerProps {
  skin: ChatSkin;
  onChange: (s: ChatSkin) => void;
}

export function SkinPicker({ skin, onChange }: SkinPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose chat skin"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors",
          open
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-[11px]">Skin</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat skin picker"
          className={cn(
            "absolute right-0 top-full mt-2 z-50",
            "w-56 rounded-xl border border-border bg-popover shadow-lg",
            "p-2 animate-[fade-in_0.15s_ease-out_both]"
          )}
        >
          {/* Header */}
          <p className="px-2 pb-2 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Chat skin
          </p>

          {/* Skin cards */}
          <ul className="flex flex-col gap-1">
            {SKINS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors text-left",
                    skin === s.id
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {/* Swatch */}
                  <span
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-md border border-border/60",
                      s.preview,
                      // Brick swatch gets a mini brick bg
                      s.id === "brick" && "border-[#C4A882]"
                    )}
                    style={
                      s.id === "brick"
                        ? {
                            backgroundImage: "url('/textures/brick-tile.svg')",
                            backgroundSize: "40px 30px",
                          }
                        : s.id === "editorial"
                        ? {
                            backgroundImage:
                              "url('/logos/tag-graffiti.webp')",
                            backgroundSize: "120%",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            opacity: 0.9,
                          }
                        : undefined
                    }
                    aria-hidden
                  />

                  {/* Label + desc */}
                  <span className="flex flex-col min-w-0">
                    <span
                      className={cn(
                        "text-xs font-medium leading-none",
                        skin === s.id ? "text-foreground" : ""
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground/70 leading-none">
                      {s.description}
                    </span>
                  </span>

                  {/* Active dot */}
                  {skin === s.id && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
