/**
 * WorkspaceSwitcher — top-bar pill that shows "Personal" or the active workspace
 * name and opens a dropdown to switch, create, or join via invite token.
 *
 * Props:
 *   jwt               — Supabase JWT for the tag-workspaces edge function
 *   activeWorkspaceId — currently selected workspace id, null = personal mode
 *   onChange          — called when the selection changes
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Plus, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  role: "workspace_admin" | "member";
  created_at: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  jwt: string | null;
  activeWorkspaceId: string | null;
  onChange: (id: string | null) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = (import.meta as Record<string, unknown>).env
  ? (import.meta as { env: { VITE_SUPABASE_URL?: string } }).env.VITE_SUPABASE_URL ?? ""
  : "";
const WS_FN_URL = `${SUPABASE_URL}/functions/v1/tag-workspaces`;

// ── Main component ────────────────────────────────────────────────────────────

export function WorkspaceSwitcher({ jwt, activeWorkspaceId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);

  // Create workspace inline state
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Accept invite inline state
  const [joining, setJoining] = useState(false);
  const [joinToken, setJoinToken] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── API helpers ─────────────────────────────────────────────────────────────

  async function callFn(body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(WS_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
    return json;
  }

  // ── Load workspaces on open ─────────────────────────────────────────────────

  const fetchWorkspaces = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    try {
      const data = await callFn({ action: "list" });
      setWorkspaces((data as Workspace[]) ?? []);
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  useEffect(() => {
    if (open && jwt) fetchWorkspaces();
  }, [open, jwt, fetchWorkspaces]);

  // ── Outside-click to close ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSelect(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  async function handleCreate() {
    const name = createName.trim();
    if (!name || !jwt) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const ws = (await callFn({ action: "create", name })) as Workspace;
      setWorkspaces((prev) => [...prev, ws]);
      onChange(ws.id);
      setOpen(false);
    } catch (err) {
      setCreateError((err as Error).message ?? "Failed to create workspace");
    } finally {
      setCreateLoading(false);
      setCreateName("");
      setCreating(false);
    }
  }

  async function handleAcceptInvite() {
    const token = joinToken.trim();
    if (!token || !jwt) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const result = (await callFn({ action: "accept_invite", token })) as { workspace_id: string };
      await fetchWorkspaces();
      onChange(result.workspace_id);
      setOpen(false);
    } catch (err) {
      setJoinError((err as Error).message ?? "Failed to accept invite");
    } finally {
      setJoinLoading(false);
      setJoinToken("");
      setJoining(false);
    }
  }

  // ── Derived label ───────────────────────────────────────────────────────────

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const label = activeWs ? activeWs.name : "Personal";

  // Don't render without auth
  if (!jwt) return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Pill trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          open
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Building2 className="h-3 w-3 shrink-0" />
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-3 pt-2.5 pb-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              Workspace
            </span>
          </div>

          {/* Personal option */}
          <button
            type="button"
            role="option"
            aria-selected={activeWorkspaceId === null}
            onClick={() => handleSelect(null)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left",
              activeWorkspaceId === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground hover:bg-muted"
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="flex-1 truncate">Personal</span>
            {activeWorkspaceId === null && <Check className="h-3 w-3 shrink-0" />}
          </button>

          {/* Workspace list */}
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground/50">Loading…</div>
          ) : (
            workspaces.map((ws) => {
              const isActive = activeWorkspaceId === ws.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(ws.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                    ws.role === "workspace_admin"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {ws.role === "workspace_admin" ? "admin" : "member"}
                  </span>
                  {isActive && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })
          )}

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-border/60" />

          {/* Create workspace section */}
          {creating ? (
            <div className="px-3 pb-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setCreateName(""); setCreateError(null); }
                  }}
                  placeholder="Workspace name"
                  disabled={createLoading}
                  maxLength={80}
                  className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createLoading || !createName.trim()}
                  className="rounded px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  {createLoading ? "…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setCreateName(""); setCreateError(null); }}
                  className="rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {createError && (
                <p className="text-[10px] text-destructive leading-tight">{createError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setCreating(true); setJoining(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Create workspace…
            </button>
          )}

          {/* Join via invite section */}
          {joining ? (
            <div className="px-3 pb-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={joinToken}
                  onChange={(e) => setJoinToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAcceptInvite();
                    if (e.key === "Escape") { setJoining(false); setJoinToken(""); setJoinError(null); }
                  }}
                  placeholder="Invite token"
                  disabled={joinLoading}
                  className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={handleAcceptInvite}
                  disabled={joinLoading || !joinToken.trim()}
                  className="rounded px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  {joinLoading ? "…" : "Accept"}
                </button>
                <button
                  type="button"
                  onClick={() => { setJoining(false); setJoinToken(""); setJoinError(null); }}
                  className="rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {joinError && (
                <p className="text-[10px] text-destructive leading-tight">{joinError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setJoining(true); setCreating(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 pb-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              Join workspace via invite…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
