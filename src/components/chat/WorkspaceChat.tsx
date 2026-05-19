// Mount this in Chat.tsx beside the main chat surface when activeWorkspaceId is non-null.
// Example: {activeWorkspaceId && <WorkspaceChat workspaceId={activeWorkspaceId} jwt={jwt} />}

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  deleted_at: string | null;
  created_at: string;
}

interface WorkspaceChatProps {
  workspaceId: string | null;
  jwt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// Resolve or create the "general" channel for a workspace.
async function resolveChannel(workspaceId: string): Promise<string | null> {
  // Try to find an existing channel for this workspace.
  const { data: existing } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Create "general" channel if none exists.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: created, error } = await supabase
    .from("chat_channels")
    .insert({ workspace_id: workspaceId, name: "general", created_by: user.id })
    .select("id")
    .single();

  if (error) {
    // Could be a race condition — try fetching again.
    const { data: retry } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return retry?.id ?? null;
  }

  return created?.id ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceChat({ workspaceId, jwt: _jwt }: WorkspaceChatProps) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages update.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Resolve channel + fetch initial messages when workspaceId changes.
  useEffect(() => {
    if (!workspaceId) {
      setChannelId(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const cid = await resolveChannel(workspaceId);
      if (cancelled || !cid) {
        setLoading(false);
        return;
      }

      // Fetch last 50 messages (desc → reverse for display).
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", cid)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!cancelled) {
        setMessages(((data ?? []) as ChatMessage[]).reverse());
        setChannelId(cid);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [workspaceId]);

  // Realtime subscription — append new messages.
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`workspace_chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Avoid duplicate if optimistic update already added it.
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const sendMessage = useCallback(async () => {
    const content = draft.trim();
    if (!content || !channelId || sending) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSending(true);
    setDraft("");

    // Optimistic message.
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      channel_id: channelId,
      user_id: user.id,
      content,
      deleted_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({ channel_id: channelId, user_id: user.id, content })
      .select()
      .single();

    if (error) {
      // Roll back optimistic message on failure.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(content);
    } else if (inserted) {
      // Replace optimistic entry with the real one.
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? (inserted as ChatMessage) : m)),
      );
    }

    setSending(false);
  }, [draft, channelId, sending]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // Workspace-only — render nothing when no workspace is active.
  if (!workspaceId) return null;

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5] border border-stone-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-200 bg-white/60">
        <span className="text-sm font-medium text-stone-700 font-[Space_Grotesk]">
          # general
        </span>
        <span className="ml-auto text-xs text-stone-400">workspace chat</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="text-xs text-stone-400 text-center py-6">Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-xs text-stone-400 text-center py-6">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-xs font-medium font-[Space_Grotesk]",
                  msg.id.startsWith("opt-")
                    ? "text-stone-400"
                    : "text-stone-600",
                )}
              >
                {msg.user_id.slice(0, 8)}
              </span>
              <span className="text-[10px] text-stone-400">
                {relativeTime(msg.created_at)}
              </span>
            </div>
            <p
              className={cn(
                "text-sm text-stone-800 leading-relaxed",
                msg.id.startsWith("opt-") && "opacity-60",
              )}
            >
              {msg.content}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="px-4 py-3 border-t border-stone-200 bg-white/40">
        <div className="flex items-end gap-2">
          <textarea
            className={cn(
              "flex-1 resize-none rounded-md border border-stone-200 bg-white",
              "px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400",
              "focus:outline-none focus:ring-1 focus:ring-stone-300",
              "font-[Space_Grotesk] min-h-[40px] max-h-[120px]",
            )}
            rows={1}
            placeholder="Message #general…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || !channelId}
          />
          <button
            onClick={sendMessage}
            disabled={!draft.trim() || sending || !channelId}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-full",
              "bg-stone-800 text-white hover:bg-stone-700 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0",
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-stone-400">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
