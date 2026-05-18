import { useEffect, useState } from "react";
import { Building2, ChevronRight, Plus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// TODO: remove `as any` casts once Supabase types are regenerated to include workspaces

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface Props {
  activeWorkspaceId: string | null;
  onSwitch: (id: string | null) => void;
  userId: string | null;
  onInviteClick: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({ activeWorkspaceId, onSwitch, userId, onInviteClick }: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchWorkspaces() {
    if (!userId) { setWorkspaces([]); return; }
    try {
      // RLS restricts to workspaces the user owns or is a member of
      // TODO: remove `as any` once types regenerated
      const { data } = await (supabase as any)
        .from("workspaces")
        .select("id, name, slug, owner_id")
        .order("created_at", { ascending: true });
      setWorkspaces((data as Workspace[]) ?? []);
    } catch {
      setWorkspaces([]);
    }
  }

  useEffect(() => {
    fetchWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed || !userId) return;
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setLoading(true);
    try {
      // TODO: remove `as any` once types regenerated
      const { data, error } = await (supabase as any)
        .from("workspaces")
        .insert({ name: trimmed, slug, owner_id: userId })
        .select("id, name, slug, owner_id")
        .single();
      if (error) throw error;
      const ws = data as Workspace;
      setWorkspaces((prev) => [...prev, ws]);
      onSwitch(ws.id);
    } catch {
      // swallow — user sees no state change
    } finally {
      setLoading(false);
      setCreating(false);
      setNewName("");
    }
  }

  if (!userId) return null;

  return (
    <div className="px-1.5 pb-2 border-b border-border/40">
      {/* Section label */}
      <div className="px-2 pt-2.5 pb-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Workspaces
        </span>
      </div>

      {/* Personal */}
      <button
        type="button"
        onClick={() => onSwitch(null)}
        className={cn(
          "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
          activeWorkspaceId === null
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">Personal</span>
        {activeWorkspaceId === null && (
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
        )}
      </button>

      {/* Workspace list */}
      {workspaces.map((ws) => {
        const isActive = activeWorkspaceId === ws.id;
        const isOwner = ws.owner_id === userId;
        return (
          <div key={ws.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSwitch(ws.id)}
              className={cn(
                "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left min-w-0",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{ws.name}</span>
              {isActive && (
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
              )}
            </button>

            {/* Invite button — only for workspace owner when active */}
            {isActive && isOwner && (
              <button
                type="button"
                onClick={() => onInviteClick(ws.id)}
                title="Invite members"
                aria-label="Invite members"
                className="rounded p-1 text-muted-foreground/60 hover:text-primary hover:bg-muted transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* New workspace — inline input or button */}
      {creating ? (
        <div className="flex items-center gap-1 px-2 py-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            placeholder="Workspace name"
            disabled={loading}
            className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
            className="rounded px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : "Create"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>New workspace</span>
        </button>
      )}
    </div>
  );
}
