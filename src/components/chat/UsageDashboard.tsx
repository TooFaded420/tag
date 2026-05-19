/**
 * UsageDashboard — collapsible sidebar panel showing aggregated usage metrics
 * fetched from the tag-usage-summary edge function.
 *
 * Usage: <UsageDashboard jwt={jwt} />
 * Not mounted anywhere yet — integrated in a follow-up commit.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Link2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const USAGE_URL = `${SUPABASE_URL}/functions/v1/tag-usage-summary`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface UsageSummary {
  thread_count: number;
  message_count_today: number;
  message_count_week: number;
  premium_msg_count_today: number;
  tool_call_count_total: number;
  tool_call_count_by_outcome: Record<string, number>;
  tool_call_count_by_tool: Record<string, number>;
  memory_count: number;
  integration_count: number;
  tier: "anon" | "free" | "pro";
  joined_at: string;
}

interface UsageDashboardProps {
  jwt: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

const TIER_LABELS: Record<string, string> = {
  pro: "Pro",
  free: "Free",
  anon: "Anon",
};

const TIER_COLORS: Record<string, string> = {
  pro: "bg-amber-100 text-amber-700",
  free: "bg-muted text-muted-foreground",
  anon: "bg-muted text-muted-foreground",
};

// Outcome badge colours match AgentActivityLog
const OUTCOME_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  auto:     "bg-blue-100 text-blue-700",
  dry_run:  "bg-muted text-muted-foreground",
  cancelled:"bg-muted text-muted-foreground",
  failed:   "bg-destructive/10 text-destructive",
};

// Horizontal bar segment colours
const OUTCOME_BAR_COLORS: Record<string, string> = {
  approved: "bg-emerald-500",
  auto:     "bg-blue-400",
  dry_run:  "bg-muted-foreground/30",
  cancelled:"bg-muted-foreground/20",
  failed:   "bg-destructive/60",
};

const OUTCOME_ORDER = ["approved", "auto", "dry_run", "cancelled", "failed"] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function UsageDashboard({ jwt }: UsageDashboardProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(USAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UsageSummary;
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    if (expanded && jwt && !data) void fetchUsage();
  }, [expanded, jwt, data, fetchUsage]);

  if (!jwt) return null;

  // Derived: top 5 tools sorted desc
  const top5Tools = data
    ? Object.entries(data.tool_call_count_by_tool)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  // Derived: outcome bar segments (total for width calc)
  const outcomeTotal = data
    ? OUTCOME_ORDER.reduce((sum, k) => sum + (data.tool_call_count_by_outcome[k] ?? 0), 0)
    : 0;

  return (
    <div className="border-t border-border/40">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 font-mono uppercase tracking-widest text-[10px]">
          <Activity className="h-3 w-3 shrink-0" />
          Usage
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Refresh button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void fetchUsage()}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Loading skeleton */}
          {loading && !data && (
            <div className="space-y-1.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <p className="text-[10px] text-destructive/70 text-center py-2">
              Could not load usage. Refresh to retry.
            </p>
          )}

          {/* Data */}
          {data && !error && (
            <div className="space-y-2.5">
              {/* Today + This week */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                  Messages
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
                    Today: {data.message_count_today} msg
                    {data.premium_msg_count_today > 0 && (
                      <> · {data.premium_msg_count_today} premium</>
                    )}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
                    Week: {data.message_count_week} msg
                  </span>
                </div>
              </div>

              {/* Tool calls */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                  Tool calls · {data.tool_call_count_total} total
                </p>

                {/* Outcome badges */}
                <div className="flex flex-wrap gap-1">
                  {OUTCOME_ORDER.map((outcome) => {
                    const count = data.tool_call_count_by_outcome[outcome] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span
                        key={outcome}
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                          OUTCOME_COLORS[outcome] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {outcome.replace("_", " ")} {count}
                      </span>
                    );
                  })}
                </div>

                {/* Horizontal bar */}
                {outcomeTotal > 0 && (
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                    {OUTCOME_ORDER.map((outcome) => {
                      const count = data.tool_call_count_by_outcome[outcome] ?? 0;
                      if (count === 0) return null;
                      const pct = (count / outcomeTotal) * 100;
                      return (
                        <div
                          key={outcome}
                          title={`${outcome}: ${count}`}
                          className={cn("h-full", OUTCOME_BAR_COLORS[outcome] ?? "bg-muted-foreground/20")}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top 5 tools */}
              {top5Tools.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest flex items-center gap-1">
                    <Wrench className="h-2.5 w-2.5" />
                    Top tools
                  </p>
                  <ul className="space-y-0.5">
                    {top5Tools.map(([slug, count]) => (
                      <li
                        key={slug}
                        className="flex items-center justify-between gap-2 text-[10px]"
                      >
                        <span className="truncate font-mono text-foreground/80">{slug}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Memories + Integrations row */}
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
                  <Brain className="h-2.5 w-2.5 text-muted-foreground" />
                  {data.memory_count} memor{data.memory_count === 1 ? "y" : "ies"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
                  <Link2 className="h-2.5 w-2.5 text-muted-foreground" />
                  {data.integration_count} integration{data.integration_count !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Tier + Joined */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    TIER_COLORS[data.tier] ?? TIER_COLORS.free,
                  )}
                >
                  <Crown className="h-2.5 w-2.5" />
                  {TIER_LABELS[data.tier] ?? data.tier}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  Joined {relativeDate(data.joined_at)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
