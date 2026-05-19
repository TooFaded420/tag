/**
 * AgentActivityLog — collapsible sidebar panel showing recent agent tool calls.
 *
 * Reads from tool_call_history table (last 20 per user).
 * Outcome badge colours: green=approved, blue=auto, gray=dry_run|cancelled, red=failed.
 */

import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface ToolCallEntry {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  outcome: string;
  result_summary: string | null;
  created_at: string;
}

interface AgentActivityLogProps {
  jwt: string | null;
}

const OUTCOME_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  auto:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  dry_run:  "bg-muted text-muted-foreground",
  cancelled:"bg-muted text-muted-foreground",
  failed:   "bg-destructive/10 text-destructive",
};

const TOOL_EMOJIS: Record<string, string> = {
  gmail_send:           "📧",
  slack_post_message:   "💬",
  github_create_issue:  "🐙",
  linear_create_issue:  "📋",
  notion_create_page:   "📄",
  calendar_create_event:"📅",
  exec_bash_safe:       "⚡",
  read_file:            "📂",
  list_files:           "🗂️",
  browser_navigate:     "🌐",
  web_search:           "🔍",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AgentActivityLog({ jwt }: AgentActivityLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<ToolCallEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/tool_call_history?select=id,tool,args,outcome,result_summary,created_at&order=created_at.desc&limit=20`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${jwt}`,
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore transient errors
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    if (expanded && jwt) void load();
  }, [expanded, jwt, load]);

  if (!jwt) return null;

  return (
    <div className="border-t border-border/40">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 font-mono uppercase tracking-widest text-[10px]">
          <Activity className="h-3 w-3 shrink-0" />
          Agent Activity
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Refresh button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {loading && entries.length === 0 ? (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50 text-center py-2">
              No tool calls yet.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {entries.map((entry) => {
                const emoji = TOOL_EMOJIS[entry.tool] ?? "🔧";
                const outcomeColor = OUTCOME_COLORS[entry.outcome] ?? OUTCOME_COLORS.auto;
                const isOpen = expandedId === entry.id;
                const argsStr = JSON.stringify(entry.args, null, 2);

                return (
                  <li key={entry.id} className="rounded-md border border-border/40 bg-muted/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : entry.id)}
                      className="w-full flex items-start gap-2 px-2 py-1.5 text-left hover:bg-muted/40 transition-colors"
                    >
                      <span className="shrink-0 text-[13px] mt-0.5">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-foreground truncate">
                            {entry.tool}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1 py-0 text-[9px] font-medium uppercase tracking-wide shrink-0",
                              outcomeColor,
                            )}
                          >
                            {entry.outcome}
                          </span>
                        </div>
                        <p className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">
                          {relativeTime(entry.created_at)}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn("h-3 w-3 shrink-0 text-muted-foreground/40 mt-1 transition-transform", isOpen && "rotate-90")}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-2 pb-2 space-y-1.5 border-t border-border/30">
                        {entry.result_summary && (
                          <p className="text-[10px] text-foreground/80 leading-snug pt-1.5">
                            {entry.result_summary}
                          </p>
                        )}
                        <details>
                          <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground select-none pt-1">
                            Args
                          </summary>
                          <pre className="mt-1 text-[9px] font-mono text-muted-foreground bg-muted/40 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                            {argsStr}
                          </pre>
                        </details>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
