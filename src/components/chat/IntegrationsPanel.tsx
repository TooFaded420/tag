/**
 * IntegrationsPanel — BYOK Composio integration management
 *
 * Users supply their own Composio API key (stored in localStorage under
 * "tag_composio_key"). Hecz never persists it server-side — it is forwarded
 * as a pass-through on each request.
 *
 * First-time state: prompt user to sign up at composio.dev and paste key.
 * Connected state: show 6-tool list with connect/disconnect per tool.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import {
  GmailIcon,
  SlackIcon,
  GitHubIcon,
  LinearIcon,
  NotionIcon,
  GoogleCalendarIcon,
} from "@/components/icons/brand";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const INTEGRATIONS_URL = `${SUPABASE_URL}/functions/v1/tag-integrations`;
export const COMPOSIO_KEY_STORAGE = "tag_composio_key";

// Allowlist of trusted OAuth redirect hostname suffixes (mirrors server-side list).
// Validated client-side before opening popup so a compromised Composio response
// cannot redirect users to untrusted domains even if the server check is bypassed.
const ALLOWED_REDIRECT_HOSTS = [
  "app.composio.dev",
  "backend.composio.dev",
  "auth.composio.dev",
  "accounts.google.com",
  "slack.com",
  "github.com",
  "linear.app",
  "www.notion.so",
  "notion.so",
];

function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.some(
      (allowed) => parsed.hostname === allowed || parsed.hostname.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

// Poll interval for OAuth completion check
const POLL_INTERVAL_MS = 2_000;
// Timeout for OAuth popup polling (5 minutes)
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function readComposioKey(): string {
  try {
    return localStorage.getItem(COMPOSIO_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function writeComposioKey(key: string) {
  try {
    if (key) {
      localStorage.setItem(COMPOSIO_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(COMPOSIO_KEY_STORAGE);
    }
  } catch {
    // ignore
  }
}

/** Format last_used_at into a short relative string. */
function formatRelativeTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "never";
  const diffMs = Date.now() - new Date(isoStr).getTime();
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

interface ToolDef {
  slug: string;
  label: string;
  Icon: React.FC<{ className?: string; size?: number }>;
}

const TOOLS: ToolDef[] = [
  { slug: "gmail", label: "Gmail", Icon: GmailIcon },
  { slug: "slack", label: "Slack", Icon: SlackIcon },
  { slug: "github", label: "GitHub", Icon: GitHubIcon },
  { slug: "linear", label: "Linear", Icon: LinearIcon },
  { slug: "notion", label: "Notion", Icon: NotionIcon },
  { slug: "googlecalendar", label: "Calendar", Icon: GoogleCalendarIcon },
];

/** Read-only probe actions per tool slug. Tools without an entry get no Test button. */
const TEST_PROBES: Record<string, Record<string, unknown>> = {
  gmail: { action: "gmail_search", query: "is:unread" },
  slack: { action: "slack_search", query: "test" },
  linear: { action: "linear_list_issues", limit: 1 },
  notion: { action: "notion_search", query: "test" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  tool_slug: string;
  connected_at: string;
  last_used_at: string | null;
}

interface IntegrationsPanelProps {
  jwt: string | null;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiCall(
  jwt: string,
  composioKey: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(INTEGRATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ ...payload, byok_composio_key: composioKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }));
    throw Object.assign(new Error(String(err?.error ?? "request failed")), {
      status: res.status,
      body: err,
    });
  }
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IntegrationsPanel({ jwt }: IntegrationsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // BYOK key state — read from localStorage on mount
  const [composioKey, setComposioKey] = useState(() => readComposioKey());
  const [keyDraft, setKeyDraft] = useState("");
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const hasKey = composioKey.length > 0;

  // Integration list state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Test connection state: slug -> "testing" | "ok" | "fail"
  const [testStates, setTestStates] = useState<Record<string, "testing" | "ok" | "fail">>({});
  const testTimerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Bulk disconnect confirm state
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDisconnecting, setBulkDisconnecting] = useState(false);

  // Polling state
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectedSlugs = new Set(integrations.map((i) => i.tool_slug));

  // ── Save key ───────────────────────────────────────────────────────────────

  const handleSaveKey = useCallback(() => {
    const trimmed = keyDraft.trim();
    const hadPreviousKey = composioKey.length > 0;
    writeComposioKey(trimmed);
    setComposioKey(trimmed);
    setKeyDraft("");
    setSavingKey(false);
    // If user had a previous key and is changing it, purge stale DB rows so
    // old connected account IDs don't ghost-fail against the new key.
    if (hadPreviousKey && jwt && trimmed) {
      void apiCall(jwt, trimmed, { action: "disconnect_all" }).catch(() => {});
    }
    setIntegrations([]);
  }, [keyDraft, composioKey, jwt]);

  const handleClearKey = useCallback(() => {
    // Purge stale DB rows before clearing — best effort, ignore errors.
    if (jwt && composioKey) {
      void apiCall(jwt, composioKey, { action: "disconnect_all" }).catch(() => {});
    }
    writeComposioKey("");
    setComposioKey("");
    setKeyDraft("");
    setIntegrations([]);
  }, [jwt, composioKey]);

  // ── Load integrations ──────────────────────────────────────────────────────

  const loadIntegrations = useCallback(async () => {
    if (!jwt || !composioKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await apiCall(jwt, composioKey, { action: "list" })) as {
        integrations: Integration[];
      };
      setIntegrations(data.integrations ?? []);
    } catch {
      setError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [jwt, composioKey]);

  useEffect(() => {
    if (expanded && jwt && hasKey) {
      void loadIntegrations();
    }
  }, [expanded, jwt, hasKey, loadIntegrations]);

  // ── Stop polling helper ────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Clean up test timers on unmount
  useEffect(() => {
    const timers = testTimerRefs.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────

  const handleConnect = useCallback(
    async (toolSlug: string) => {
      if (!jwt || !composioKey) return;
      setConnecting(toolSlug);
      setError(null);

      try {
        const data = (await apiCall(jwt, composioKey, {
          action: "connect",
          tool_slug: toolSlug,
        })) as {
          redirectUrl: string;
          connectedAccountId: string;
        };

        // Validate redirectUrl before opening popup — prevents open redirect if
        // Composio response is compromised or misconfigured.
        if (!isAllowedRedirectUrl(data.redirectUrl)) {
          setError("Untrusted redirect URL from Composio");
          setConnecting(null);
          return;
        }

        // Open OAuth popup
        window.open(
          data.redirectUrl,
          "_blank",
          "popup,width=600,height=700,left=200,top=100",
        );

        const connectedAccountId = data.connectedAccountId;
        const startedAt = Date.now();

        // Start polling for completion
        stopPolling();

        pollRef.current = setInterval(async () => {
          try {
            const checkData = (await apiCall(jwt, composioKey, {
              action: "check",
              connectedAccountId,
            })) as { connected: boolean; tool_slug?: string };

            if (checkData.connected) {
              stopPolling();
              setConnecting(null);
              await loadIntegrations();
            }
          } catch {
            // ignore transient errors during polling
          }
        }, POLL_INTERVAL_MS);

        // Timeout after 5 minutes — Math.max guards against negative delay if
        // the connect round-trip itself took longer than POLL_TIMEOUT_MS.
        pollTimeoutRef.current = setTimeout(() => {
          stopPolling();
          setConnecting(null);
          setError("OAuth flow timed out. Please try again.");
        }, Math.max(0, POLL_TIMEOUT_MS - (Date.now() - startedAt)));
      } catch (err) {
        const e = err as Error & { body?: { error?: string; message?: string } };
        const msg =
          e?.body?.message ?? e?.body?.error ?? e?.message ?? "Failed to initiate connection";
        setError(msg);
        setConnecting(null);
      }
    },
    [jwt, composioKey, loadIntegrations, stopPolling],
  );

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const handleDisconnect = useCallback(
    async (toolSlug: string) => {
      if (!jwt || !composioKey) return;
      if (
        !window.confirm(
          `Disconnect ${toolSlug}? The agent will no longer be able to use it.`,
        )
      ) {
        return;
      }
      setDisconnecting(toolSlug);
      setError(null);
      try {
        await apiCall(jwt, composioKey, { action: "disconnect", tool_slug: toolSlug });
        await loadIntegrations();
      } catch (err) {
        const e = err as Error;
        setError(e?.message ?? "Failed to disconnect");
      } finally {
        setDisconnecting(null);
      }
    },
    [jwt, composioKey, loadIntegrations],
  );

  // ── Test connection ────────────────────────────────────────────────────────

  const handleTest = useCallback(
    async (toolSlug: string) => {
      if (!jwt || !composioKey) return;
      // Clear any existing timer for this slug
      if (testTimerRefs.current[toolSlug]) {
        clearTimeout(testTimerRefs.current[toolSlug]);
      }
      setTestStates((prev) => ({ ...prev, [toolSlug]: "testing" }));
      try {
        const probe = TEST_PROBES[toolSlug];
        await apiCall(jwt, composioKey, { ...probe, tool_slug: toolSlug });
        setTestStates((prev) => ({ ...prev, [toolSlug]: "ok" }));
      } catch {
        setTestStates((prev) => ({ ...prev, [toolSlug]: "fail" }));
      }
      // Clear result after 3s
      testTimerRefs.current[toolSlug] = setTimeout(() => {
        setTestStates((prev) => {
          const next = { ...prev };
          delete next[toolSlug];
          return next;
        });
      }, 3_000);
    },
    [jwt, composioKey],
  );

  // ── Bulk disconnect ────────────────────────────────────────────────────────

  const handleBulkDisconnect = useCallback(async () => {
    if (!jwt || !composioKey) return;
    setBulkDisconnecting(true);
    setError(null);
    try {
      await apiCall(jwt, composioKey, { action: "disconnect_all" });
      setIntegrations([]);
    } catch (err) {
      const e = err as Error;
      setError(e?.message ?? "Failed to disconnect all");
    } finally {
      setBulkDisconnecting(false);
      setBulkConfirm(false);
    }
  }, [jwt, composioKey]);

  // ── Sort integrations: connected (by recency) first, then disconnected ─────

  const sortedTools = [...TOOLS].sort((a, b) => {
    const aConnected = connectedSlugs.has(a.slug);
    const bConnected = connectedSlugs.has(b.slug);
    if (aConnected && !bConnected) return -1;
    if (!aConnected && bConnected) return 1;
    if (aConnected && bConnected) {
      const aInt = integrations.find((i) => i.tool_slug === a.slug);
      const bInt = integrations.find((i) => i.tool_slug === b.slug);
      const aTime = aInt?.last_used_at ? new Date(aInt.last_used_at).getTime() : 0;
      const bTime = bInt?.last_used_at ? new Date(bInt.last_used_at).getTime() : 0;
      return bTime - aTime;
    }
    return 0;
  });

  const connectedCount = integrations.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!jwt) return null;

  return (
    <div className="border-t border-border/40">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-mono uppercase tracking-widest text-[10px]">Integrations</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* ── No key: first-time setup ──────────────────────────────── */}
          {!hasKey && !savingKey && (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 space-y-2">
              <p className="text-[11px] text-foreground font-medium leading-snug">
                Connect your Composio account to enable agent integrations
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Sign up at Composio, then paste your API key below. Your key stays in your
                browser — Hecz never stores it server-side, only forwards it as a pass-through.
              </p>
              <a
                href="https://composio.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                Sign up at composio.dev →
              </a>
              <button
                type="button"
                onClick={() => setSavingKey(true)}
                className="w-full rounded-md border border-primary/40 px-2.5 py-1.5 text-[11px] text-primary hover:bg-primary/8 transition-colors"
              >
                Add Composio API key
              </button>
            </div>
          )}

          {/* ── Key entry form ────────────────────────────────────────── */}
          {(!hasKey && savingKey) || (hasKey && savingKey) ? (
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Composio API Key
              </label>
              <div className="relative flex gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={keyRevealed ? "text" : "password"}
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveKey();
                      if (e.key === "Escape") {
                        setSavingKey(false);
                        setKeyDraft("");
                      }
                    }}
                    placeholder="comp_..."
                    autoFocus
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 pr-8 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setKeyRevealed((r) => !r)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={keyRevealed ? "Hide key" : "Show key"}
                  >
                    {keyRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={!keyDraft.trim()}
                  className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSavingKey(false);
                    setKeyDraft("");
                  }}
                  className="rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Your key stays in your browser. Hecz never stores it server-side — it is only
                forwarded as a pass-through to Composio per request.
              </p>
            </div>
          ) : null}

          {/* ── Has key: indicator + change link ─────────────────────── */}
          {hasKey && !savingKey && (
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">
                Composio: {"•".repeat(Math.min(composioKey.length, 8))}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setKeyDraft(composioKey);
                    setSavingKey(true);
                  }}
                  className="text-[10px] text-primary hover:underline"
                >
                  Change key
                </button>
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────────── */}
          {error && (
            <p className="text-[10px] text-destructive px-0.5">{error}</p>
          )}

          {/* ── Tool list (only when key is present) ─────────────────── */}
          {hasKey && !savingKey && (
            <>
              {loading ? (
                <div className="space-y-1.5 pt-0.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-7 rounded bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <ul className="space-y-0.5">
                    {sortedTools.map(({ slug, label, Icon }, idx) => {
                      const isConnected = connectedSlugs.has(slug);
                      const isConnecting = connecting === slug;
                      const isDisconnecting = disconnecting === slug;
                      const integration = integrations.find((i) => i.tool_slug === slug);
                      const testState = testStates[slug];

                      // Separator between connected and disconnected groups
                      const prevSlug = idx > 0 ? sortedTools[idx - 1].slug : null;
                      const prevConnected = prevSlug ? connectedSlugs.has(prevSlug) : isConnected;
                      const showSeparator = idx > 0 && prevConnected && !isConnected;

                      return (
                        <li key={slug}>
                          {showSeparator && (
                            <div className="my-1 border-t border-border/30" />
                          )}
                          <div
                            className={cn(
                              "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                              isConnected
                                ? "text-foreground hover:bg-muted"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted",
                            )}
                          >
                            {/* Connected indicator */}
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                isConnected ? "bg-emerald-500" : "bg-muted-foreground/30",
                              )}
                              aria-hidden
                            />

                            {/* Tool icon + label */}
                            <Icon className="shrink-0" size={18} />
                            <span className="flex-1 truncate text-[11px]">{label}</span>

                            {/* Status badge (connected only) */}
                            {isConnected && integration && (
                              <span
                                className={cn(
                                  "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none",
                                  integration.last_used_at
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {integration.last_used_at
                                  ? formatRelativeTime(integration.last_used_at) === "just now"
                                    ? "Active"
                                    : formatRelativeTime(integration.last_used_at)
                                  : "never"}
                              </span>
                            )}

                            {/* Test button (connected only, tools with a read-only probe only) */}
                            {isConnected && slug in TEST_PROBES && (
                              <button
                                type="button"
                                onClick={() => handleTest(slug)}
                                disabled={testState === "testing"}
                                className={cn(
                                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100",
                                  testState === "ok"
                                    ? "inline-flex text-emerald-600 bg-emerald-500/10"
                                    : testState === "fail"
                                      ? "inline-flex text-destructive bg-destructive/10"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                                )}
                                aria-label={`Test ${label} connection`}
                              >
                                {testState === "testing"
                                  ? "…"
                                  : testState === "ok"
                                    ? "✓ Working"
                                    : testState === "fail"
                                      ? "✗ Failed"
                                      : "Test"}
                              </button>
                            )}

                            {/* Action button */}
                            {isConnected ? (
                              <button
                                type="button"
                                onClick={() => handleDisconnect(slug)}
                                disabled={isDisconnecting}
                                className="inline-flex opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 items-center rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity disabled:opacity-50"
                                aria-label={`Disconnect ${label}`}
                              >
                                {isDisconnecting ? "…" : "Disconnect"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConnect(slug)}
                                disabled={isConnecting}
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                aria-label={`Connect ${label}`}
                              >
                                {isConnecting ? "…" : "Connect"}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* ── Bulk disconnect ─────────────────────────────── */}
                  {connectedCount > 0 && (
                    <div className="pt-1 flex items-center justify-end gap-2">
                      {bulkConfirm ? (
                        <>
                          <span className="text-[10px] text-muted-foreground">Disconnect all?</span>
                          <button
                            type="button"
                            onClick={handleBulkDisconnect}
                            disabled={bulkDisconnecting}
                            className="rounded px-2 py-0.5 text-[10px] text-destructive border border-destructive/40 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {bulkDisconnecting ? "…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setBulkConfirm(false)}
                            className="rounded px-2 py-0.5 text-[10px] text-muted-foreground border border-border hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBulkConfirm(true)}
                          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Disconnect all
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
