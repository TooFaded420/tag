import { useEffect, useRef, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Mem0Memory {
  id: string;
  content: string;
  importance: number;
  similarity: number;
  created_at: string;
}

async function fetchRecentMemories(jwt: string): Promise<Mem0Memory[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mem0-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query: "recent conversation context", limit: 8 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.memories as Mem0Memory[]) ?? [];
  } catch {
    return [];
  }
}

function relativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

/** Clamp importance to [0,1] range for display. */
function importanceFraction(importance: number): number {
  return Math.max(0, Math.min(1, importance ?? 0));
}

interface MemoryPanelProps {
  jwt: string | null;
}

export function MemoryPanel({ jwt }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Mem0Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!jwt) return;
      setLoading(true);
      const result = await fetchRecentMemories(jwt);
      if (!cancelled) {
        setMemories(result);
        setLoading(false);
      }
    }

    load();

    intervalRef.current = setInterval(() => {
      load();
    }, 60_000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jwt]);

  // Anon users: render nothing
  if (!jwt) return null;

  return (
    <aside className="flex flex-col gap-3">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        I remember
      </h2>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-md bg-muted/40"
            />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          No memories yet — your prompts are saved as you chat.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {memories.map((mem) => (
            <li
              key={mem.id}
              className="rounded-md border border-border/60 bg-muted/40 px-3 py-2.5"
            >
              <p className="line-clamp-2 text-xs text-foreground leading-relaxed">
                {mem.content}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {relativeTime(mem.created_at)}
                </span>
                {/* Importance bar: 5 dots */}
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const filled = i < Math.round(importanceFraction(mem.importance) * 5);
                    return (
                      <span
                        key={i}
                        className={
                          filled
                            ? "h-1.5 w-1.5 rounded-full bg-primary/70"
                            : "h-1.5 w-1.5 rounded-full bg-muted-foreground/20"
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
