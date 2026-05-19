import { useEffect, useDeferredValue, useRef, useState } from "react";
import { Pin } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PINNED_STORAGE_KEY = "tag_pinned_memories";

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

/** Return 1, 2, or 3 dots based on importance bucket. */
function importanceDots(importance: number): number {
  const f = importanceFraction(importance);
  if (f <= 0.33) return 1;
  if (f <= 0.66) return 2;
  return 3;
}

function loadPinnedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    localStorage.removeItem(PINNED_STORAGE_KEY);
    return new Set();
  }
}

function savePinnedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // storage unavailable — silently ignore
  }
}

interface MemoryPanelProps {
  jwt: string | null;
}

export function MemoryPanel({ jwt }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Mem0Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(loadPinnedIds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deferredQuery = useDeferredValue(search);

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
        setPinnedIds((prev) => {
          const liveIds = new Set(result.map((m) => m.id));
          const pruned = new Set([...prev].filter((id) => liveIds.has(id)));
          if (pruned.size !== prev.size) {
            savePinnedIds(pruned);
          }
          return pruned;
        });
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

  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      savePinnedIds(next);
      return next;
    });
  }

  // Anon users: render nothing
  if (!jwt) return null;

  const lowerQuery = deferredQuery.toLowerCase().trim();
  const filtered = lowerQuery
    ? memories.filter((m) => m.content.toLowerCase().includes(lowerQuery))
    : memories;

  const byDate = (a: Mem0Memory, b: Mem0Memory) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  // Sort: pinned first (newest → oldest), then unpinned (newest → oldest)
  const sorted = [
    ...filtered.filter((m) => pinnedIds.has(m.id)).sort(byDate),
    ...filtered.filter((m) => !pinnedIds.has(m.id)).sort(byDate),
  ];

  return (
    <aside className="flex flex-col gap-3">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        I remember ({loading ? "…" : sorted.length})
      </h2>

      {/* Search input */}
      <input
        type="search"
        placeholder="Filter memories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary/40"
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-md bg-muted/40"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {lowerQuery
            ? "No memories match that search."
            : "No memories yet — your prompts are saved as you chat."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((mem) => {
            const pinned = pinnedIds.has(mem.id);
            const dots = importanceDots(mem.importance);
            return (
              <li
                key={mem.id}
                className="rounded-md border border-border/60 bg-muted/40 px-3 py-2.5"
              >
                {/* Pinned badge */}
                {pinned && (
                  <span className="mb-1 inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary/70">
                    <Pin className="h-2.5 w-2.5" />
                    Pinned
                  </span>
                )}
                <p className="line-clamp-2 text-xs text-foreground leading-relaxed">
                  {mem.content}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {relativeTime(mem.created_at)}
                    </span>
                    {/* Importance: 1-3 dots */}
                    <div className="flex items-center gap-0.5" title={`Importance: ${mem.importance?.toFixed(2) ?? "n/a"}`}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className={
                            i < dots
                              ? "h-1.5 w-1.5 rounded-full bg-primary/70"
                              : "h-1.5 w-1.5 rounded-full bg-muted-foreground/20"
                          }
                        />
                      ))}
                    </div>
                  </div>
                  {/* Pin button */}
                  <button
                    type="button"
                    onClick={() => togglePin(mem.id)}
                    title={pinned ? "Unpin memory" : "Pin memory"}
                    className={`rounded p-0.5 transition-colors ${
                      pinned
                        ? "text-primary/70 hover:text-primary"
                        : "text-muted-foreground/40 hover:text-muted-foreground"
                    }`}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
