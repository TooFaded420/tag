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
import { Building2, Check, ChevronDown, Copy, Link2, Plus, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  role: "workspace_admin" | "member";
  created_at: string;
}

interface InviteResult {
  token: string;
  invite_url: string;
  expires_at: string;
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

  // Generate invite inline state — keyed by workspace id
  const [invitingWsId, setInvitingWsId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<"member" | "workspace_admin">("member");
  const [inviteTtl, setInviteTtl] = useState<7 | 30 | 90>(7);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setCreateLoading(false);
      setCreateName("");
      setCreating(false);
    } catch (err) {
      setCreateError((err as Error).message ?? "Failed to create workspace");
      setCreateLoading(false);
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
      setJoinLoading(false);
      setJoinToken("");
      setJoining(false);
    } catch (err) {
      setJoinError((err as Error).message ?? "Failed to accept invite");
      setJoinLoading(false);
    }
  }

  function openInvitePanel(wsId: string) {
    setInvitingWsId(wsId);
    setInviteRole("member");
    setInviteTtl(7);
    setInviteResult(null);
    setInviteError(null);
    setCopied(false);
    // close other panels
    setCreating(false);
    setJoining(false);
  }

  function closeInvitePanel() {
    setInvitingWsId(null);
    setInviteResult(null);
    setInviteError(null);
    setCopied(false);
  }

  async function handleGenerateInvite() {
    if (!invitingWsId || !jwt) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const result = (await callFn({
        action: "create_invite",
        workspace_id: invitingWsId,
        role: inviteRole,
        ttl_days: inviteTtl,
      })) as InviteResult;
      setInviteResult(result);
    } catch (err) {
      setInviteError((err as Error).message ?? "Could not create invite. Try again.");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
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
              const isAdmin = ws.role === "workspace_admin";
              const isInviting = invitingWsId === ws.id;

              return (
                <div key={ws.id}>
                  {/* Workspace row */}
                  <div className={cn(
                    "flex items-center gap-1 px-3 py-1.5 text-xs transition-colors",
                    isActive ? "bg-primary/10" : "hover:bg-muted"
                  )}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(ws.id)}
                      className={cn(
                        "flex-1 flex items-center gap-2 text-left min-w-0",
                        isActive ? "text-primary font-medium" : "text-foreground"
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="flex-1 truncate">{ws.name}</span>
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                        isAdmin
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isAdmin ? "admin" : "member"}
                      </span>
                      {isActive && <Check className="h-3 w-3 shrink-0" />}
                    </button>

                    {/* Invite button — admin only */}
                    {isAdmin && (
                      <button
                        type="button"
                        title="Generate invite link"
                        onClick={(e) => {
                          e.stopPropagation();
                          isInviting ? closeInvitePanel() : openInvitePanel(ws.id);
                        }}
                        className={cn(
                          "shrink-0 rounded p-1 transition-colors",
                          isInviting
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                        )}
                      >
                        <Link2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Invite panel — inline expanded below the row */}
                  {isInviting && (
                    <div className="mx-2 mb-2 rounded-lg border border-border/70 bg-background px-3 py-2.5 space-y-2">
                      {inviteResult ? (
                        /* ── Result state ── */
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-foreground">Invite link</p>
                          <div className="flex items-center gap-1">
                            <input
                              readOnly
                              value={inviteResult.invite_url}
                              className="flex-1 min-w-0 rounded border border-border bg-muted px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopy(inviteResult.invite_url)}
                              className={cn(
                                "shrink-0 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                                copied
                                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                  : "bg-primary/10 text-primary hover:bg-primary/20"
                              )}
                            >
                              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Expires: {new Date(inviteResult.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <button
                            type="button"
                            onClick={closeInvitePanel}
                            className="rounded px-2 py-1 text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        /* ── Form state ── */
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {/* Role dropdown */}
                            <div className="flex-1 space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-mono">Role</label>
                              <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value as "member" | "workspace_admin")}
                                disabled={inviteLoading}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                              >
                                <option value="member">Member</option>
                                <option value="workspace_admin">Workspace admin</option>
                              </select>
                            </div>
                            {/* TTL dropdown */}
                            <div className="flex-1 space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-mono">Expires</label>
                              <select
                                value={inviteTtl}
                                onChange={(e) => setInviteTtl(Number(e.target.value) as 7 | 30 | 90)}
                                disabled={inviteLoading}
                                className="w-full rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                              >
                                <option value={7}>7 days</option>
                                <option value={30}>30 days</option>
                                <option value={90}>90 days</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleGenerateInvite}
                              disabled={inviteLoading}
                              className="flex-1 rounded px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                            >
                              {inviteLoading ? "Generating…" : "Generate invite link"}
                            </button>
                            <button
                              type="button"
                              onClick={closeInvitePanel}
                              className="rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {inviteError && (
                            <p className="text-[10px] text-destructive leading-tight">{inviteError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
              onClick={() => { setCreating(true); setJoining(false); closeInvitePanel(); }}
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
              onClick={() => { setJoining(true); setCreating(false); closeInvitePanel(); }}
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
