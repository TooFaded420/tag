/**
 * NotificationCenter — bell icon with unread badge + popover notification list.
 *
 * Props: jwt (Supabase Bearer token, null when signed out).
 * - Polls unread_count every 60s.
 * - Full list fetched only when popover opens.
 * - Click on a notification marks it read and navigates to link if present.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_URL = `${SUPABASE_URL}/functions/v1/tag-notifications`;

// TODO: Update types after migration applied
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationCenterProps {
  jwt: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function callFn(jwt: string, body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`tag-notifications: ${res.status}`);
  return res.json();
}

export function NotificationCenter({ jwt }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ── Fetch unread count ───────────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!jwt) return;
    try {
      const data = await callFn(jwt, { action: "unread_count" });
      setUnreadCount(data.count ?? 0);
    } catch {
      // silent — badge simply won't update
    }
  }, [jwt]);

  // Initial + poll every 60s
  useEffect(() => {
    if (!jwt) return;
    void fetchUnreadCount();
    const id = setInterval(() => void fetchUnreadCount(), 60_000);
    return () => clearInterval(id);
  }, [jwt, fetchUnreadCount]);

  // ── Fetch full list when popover opens ──────────────────────────────────────
  const fetchList = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    try {
      const data = await callFn(jwt, { action: "list" });
      setNotifications(data.notifications ?? []);
      setListLoaded(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    if (open && jwt && !listLoaded) {
      void fetchList();
    }
  }, [open, jwt, listLoaded, fetchList]);

  // ── Outside-click closes popover ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Mark single notification read ───────────────────────────────────────────
  async function handleNotificationClick(n: Notification) {
    if (!jwt) return;
    if (!n.read_at) {
      // optimistic update
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await callFn(jwt, { action: "mark_read", notification_id: n.id });
      } catch {
        // revert on failure is acceptable — count will resync on next poll
      }
    }
    if (n.link) {
      window.location.href = n.link;
    }
    if (!n.link) {
      setOpen(false);
    }
  }

  // ── Mark all read ────────────────────────────────────────────────────────────
  async function handleMarkAllRead() {
    if (!jwt) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    setUnreadCount(0);
    try {
      await callFn(jwt, { action: "mark_all_read" });
    } catch {
      // silent
    }
  }

  if (!jwt) return null;

  return (
    <div className="relative shrink-0">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label="Notifications"
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors relative",
          open
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted",
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread`}
            className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-destructive ring-1 ring-card"
          />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            {notifications.some((n) => !n.read_at) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 px-3 py-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No notifications yet
              </p>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const unread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/40",
                          unread && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {unread && (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                          <div className={cn("flex-1 min-w-0", !unread && "pl-3.5")}>
                            <p
                              className={cn(
                                "text-xs truncate",
                                unread ? "font-semibold text-foreground" : "font-normal text-foreground/80",
                              )}
                            >
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {n.body}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                              {relativeTime(n.created_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
