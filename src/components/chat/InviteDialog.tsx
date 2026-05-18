import { useEffect, useState } from "react";
import { Check, Copy, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// TODO: remove `as any` casts once Supabase types are regenerated to include workspace tables

interface Member {
  user_id: string;
  role: "workspace_admin" | "member";
  joined_at: string;
}

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export function InviteDialog({ workspaceId, open, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load members on open
  useEffect(() => {
    if (!open) return;
    setInviteUrl(null);
    setError(null);
    setCopied(false);
    (async () => {
      try {
        // TODO: remove `as any` once types regenerated
        const { data } = await (supabase as any)
          .from("workspace_members")
          .select("user_id, role, joined_at")
          .eq("workspace_id", workspaceId)
          .order("joined_at", { ascending: true });
        setMembers((data as Member[]) ?? []);
      } catch {
        setMembers([]);
      }
    })();
  }, [open, workspaceId]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleGenerateLink() {
    setGenerating(true);
    setError(null);
    try {
      // TODO: remove `as any` once types regenerated
      const { data, error: rpcError } = await (supabase as any).rpc(
        "create_workspace_invite",
        { p_workspace_id: workspaceId }
      );
      if (rpcError) throw rpcError;
      const result = data as { token: string; invite_url: string; expires_at: string };
      setInviteUrl(result.invite_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invite link");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the input
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite members"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Invite members</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Members */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2">
              Members ({members.length})
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground/50">No members yet.</p>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {m.user_id.slice(0, 8)}…
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                        m.role === "workspace_admin"
                          ? "bg-primary/15 text-primary"
                          : "border border-border text-muted-foreground"
                      )}
                    >
                      {m.role === "workspace_admin" ? "Admin" : "Member"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invite link */}
          <div className="px-4 pb-4 space-y-2">
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            {inviteUrl ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 min-w-0 rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground focus:outline-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy invite link"
                  className="rounded-md p-1.5 border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={generating}
                className="w-full rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {generating ? "Generating..." : "Generate share link"}
              </button>
            )}

            {inviteUrl && (
              <p className="text-[10px] text-muted-foreground/50 text-center">
                Link expires in 7 days. Single use.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
