import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Helmet } from "react-helmet-async";
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain,
  Crown,
  Key,
  Lock,
  Menu,
  MessageSquarePlus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelPicker, MODELS } from "@/components/chat/ModelPicker";
import { BYOKDrawer, readBYOKKeys } from "@/components/chat/BYOKDrawer";
import { TurnstileGate } from "@/components/chat/TurnstileGate";
import { MemoryPanel } from "@/components/chat/MemoryPanel";
import { CompareView } from "@/components/chat/CompareView";
import { FileDropzone } from "@/components/chat/FileDropzone";
import { SkinPicker, useChatSkin } from "@/components/chat/SkinPicker";
import type { Message } from "@ai-sdk/react";

const MessageContent = lazy(() => import("@/components/chat/MessageContent"));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/synthetic-public-proxy`;
const DEFAULT_MODEL = MODELS[0].id;
const THREAD_STORAGE_KEY = "tag_threads_v1";
const ACTIVE_THREAD_KEY = "tag_active_thread_v1";
const ANON_SESSION_KEY = "tag_anon_session_v1";

// ---------------------------------------------------------------------------
// Thread management types + helpers
// ---------------------------------------------------------------------------

interface Thread {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(THREAD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Thread[]) : [];
  } catch {
    return [];
  }
}

function saveThreads(threads: Thread[]): void {
  try {
    localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // quota — ignore
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Memory helpers (unchanged from original)
// ---------------------------------------------------------------------------

interface Mem0Memory {
  id: string;
  content: string;
  importance: number;
  similarity: number;
  created_at: string;
}

async function searchMemories(query: string, jwt: string): Promise<Mem0Memory[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mem0-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.memories as Mem0Memory[]) ?? [];
  } catch {
    return [];
  }
}

function writeMemory(content: string, jwt: string): void {
  fetch(`${SUPABASE_URL}/functions/v1/mem0-write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ content }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// EmptyState — spray-paint motif
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 select-none">
      {/* Spray-paint splatter SVG — mauve + warm yellow */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden
        className="mb-6 opacity-60"
      >
        {/* Central blob */}
        <ellipse cx="40" cy="42" rx="18" ry="16" fill="#8B7DA8" opacity="0.25" />
        <ellipse cx="40" cy="41" rx="11" ry="10" fill="#8B7DA8" opacity="0.45" />
        {/* Splatter drops */}
        <circle cx="22" cy="30" r="3.5" fill="#8B7DA8" opacity="0.3" />
        <circle cx="58" cy="28" r="2.5" fill="#8B7DA8" opacity="0.25" />
        <circle cx="62" cy="50" r="4" fill="#8B7DA8" opacity="0.2" />
        <circle cx="18" cy="54" r="3" fill="#8B7DA8" opacity="0.2" />
        <circle cx="32" cy="18" r="2" fill="#B0A3C4" opacity="0.4" />
        <circle cx="52" cy="62" r="2.5" fill="#B0A3C4" opacity="0.35" />
        {/* Cyan accent dots */}
        <circle cx="66" cy="36" r="2" fill="#5EEAD4" opacity="0.5" />
        <circle cx="14" cy="38" r="1.5" fill="#5EEAD4" opacity="0.4" />
        <circle cx="44" cy="10" r="1.5" fill="#5EEAD4" opacity="0.35" />
      </svg>

      <p
        className="text-lg font-medium text-foreground"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Tag a model. Ask anything.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Free: 10 messages/day anonymous · 50/day signed in.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadRow — single item in the sidebar conversation list
// ---------------------------------------------------------------------------

interface ThreadRowProps {
  thread: Thread;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ThreadRow({ thread, active, onSelect, onDelete }: ThreadRowProps) {
  const firstMsg = thread.messages.find((m) => m.role === "user");
  const firstMsgText = firstMsg
    ? (firstMsg.parts?.find((p) => p.type === "text") as { type: "text"; text: string } | undefined)?.text
      ?? (firstMsg as unknown as { content?: string }).content
      ?? "(empty)"
    : null;
  const title =
    thread.title ||
    (firstMsgText
      ? firstMsgText.slice(0, 52) + (firstMsgText.length > 52 ? "…" : "")
      : "New conversation");

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full text-left rounded-md px-3 py-2.5 transition-colors",
          "border-b border-border/40 last:border-b-0",
          active
            ? "bg-primary/8 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        {/* Active indicator stripe */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r bg-primary" />
        )}
        <p
          className={cn(
            "line-clamp-1 text-xs leading-snug pr-5",
            active ? "font-medium text-foreground" : "font-normal"
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">
          {relativeTime(thread.createdAt)}
        </p>
      </button>

      {/* Delete button — only visible on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete conversation"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main Chat page
// ---------------------------------------------------------------------------

export default function Chat() {
  // ── Skin ────────────────────────────────────────────────────────────────
  const [skin, setSkin] = useChatSkin();

  // ── Core state ─────────────────────────────────────────────────────────
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [userId, setUserId] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [upgrading, setUpgrading] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [byokKeys, setByokKeys] = useState(() => readBYOKKeys());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [anonSession, setAnonSession] = useState<string | null>(() => {
    try { return localStorage.getItem(ANON_SESSION_KEY); } catch { return null; }
  });
  const [memoryActive, setMemoryActive] = useState(false);
  const [view, setView] = useState<"chat" | "compare">("chat");
  const [pendingFileNote, setPendingFileNote] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);

  // ── Sidebar / thread state ──────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_THREAD_KEY); } catch { return null; }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastWrittenMemoryRef = useRef<string>("");

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setJwt(data.session?.access_token ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setJwt(session?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setTier("free"); return; }
    supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.tier === "pro") setTier("pro");
        else setTier("free");
      });
  }, [userId]);

  // Auto-fire upgrade flow when redirected back from OAuth with ?upgrade=1
  useEffect(() => {
    if (!jwt) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "1") {
      // Remove the param without triggering navigation
      window.history.replaceState({}, "", window.location.pathname);
      handleUpgrade();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt]);

  // userId tracked for T5/T6 usage display
  void userId;

  // ── Resolve the active thread's initial messages ────────────────────────
  const initialMessages = useMemo<Message[]>(() => {
    if (!activeThreadId) return [];
    const thread = threads.find((t) => t.id === activeThreadId);
    return thread?.messages ?? [];
  }, [activeThreadId]); // intentionally not reactive on threads changes after mount

  // ── useChat ─────────────────────────────────────────────────────────────
  const chat = useChat({
    initialMessages,
    transport: new DefaultChatTransport({
      api: PROXY_URL,
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      body: {
        model,
        turnstile_token: jwt ? undefined : turnstileToken,
        anon_session_token: jwt ? undefined : anonSession,
      },
      fetch: async (input, init) => {
      const reqBody = init?.body ? JSON.parse(init.body as string) : {};

      const messages: Array<{ role: string; content: string }> = reqBody.messages ?? [];
      const latestUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const latestUserContent = latestUserMsg?.content ?? "";

      let finalMessages = messages;
      if (pendingFileNote) {
        const fileNoteMsg = {
          role: "system",
          content: `[File just uploaded] ${pendingFileNote} The file's content has been stored in your memory and is available for retrieval.`,
        };
        finalMessages = [fileNoteMsg, ...finalMessages];
        setPendingFileNote(null);
      }

      if (jwt && latestUserContent) {
        const memories = await searchMemories(latestUserContent, jwt);
        if (memories.length > 0) {
          const alreadyInjected = messages.some(
            (m) => m.role === "system" && m.content.startsWith("You have access to the user's previous context.")
          );
          if (!alreadyInjected) {
            const MAX_MEMORY_CHARS = 500;
            const MAX_TOTAL_INJECT = 2000;
            const HEADER = "You have access to the user's previous context. Relevant memories:\n";
            let totalChars = HEADER.length;
            const lines: string[] = [];
            for (const m of memories) {
              const snippet = m.content.length > MAX_MEMORY_CHARS
                ? m.content.slice(0, MAX_MEMORY_CHARS) + "…"
                : m.content;
              const line = `- ${snippet}`;
              if (totalChars + line.length + 1 > MAX_TOTAL_INJECT) break;
              lines.push(line);
              totalChars += line.length + 1;
            }
            if (lines.length > 0) {
              finalMessages = [{ role: "system", content: HEADER + lines.join("\n") }, ...finalMessages];
              setMemoryActive(true);
            }
          }
        }
      }

      const DIRECT_BYOK_PROVIDERS: Record<string, string> = {
        openrouter: "https://openrouter.ai/api/v1/chat/completions",
        openai: "https://api.openai.com/v1/chat/completions",
        synthetic: "https://api.synthetic.new/v1/chat/completions",
      };

      let activeBYOKProvider: string | undefined;
      let activeBYOKKey: string | undefined;
      for (const [provider, key] of Object.entries(byokKeys)) {
        if (key && byokKeys[provider]) {
          if (provider === "synthetic" && model.startsWith("hf:")) {
            activeBYOKProvider = "synthetic";
            activeBYOKKey = key;
            break;
          } else if (provider !== "synthetic") {
            activeBYOKProvider = provider;
            activeBYOKKey = key;
            break;
          }
        }
      }
      if (!activeBYOKProvider && model.startsWith("hf:") && byokKeys["synthetic"]) {
        activeBYOKProvider = "synthetic";
        activeBYOKKey = byokKeys["synthetic"];
      }

      let response: Response;

      if (activeBYOKProvider && activeBYOKKey && DIRECT_BYOK_PROVIDERS[activeBYOKProvider]) {
        const directUrl = DIRECT_BYOK_PROVIDERS[activeBYOKProvider];
        response = await fetch(directUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeBYOKKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: finalMessages,
            temperature: reqBody.temperature ?? 0.7,
            max_tokens: reqBody.max_tokens ?? 4096,
          }),
        });
      } else if (activeBYOKProvider && activeBYOKKey) {
        response = await fetch(input as RequestInfo, {
          ...init,
          body: JSON.stringify({
            ...reqBody,
            messages: finalMessages,
            model,
            byok_provider: activeBYOKProvider,
          }),
        });
      } else {
        response = await fetch(input as RequestInfo, {
          ...init,
          body: JSON.stringify({ ...reqBody, messages: finalMessages, model }),
        });
      }

      if (!response.ok) {
        let errMsg = "Chat request failed";
        try {
          const errData = await response.json();
          errMsg = errData?.error ?? errMsg;
          // Clear stale anon session on any auth-related 400 so the user isn't
          // stuck in a loop. Server returns "Verify you are human…" for expired
          // sessions which doesn't contain "turnstile" — match broader set.
          const lc = errMsg.toLowerCase();
          if (!jwt && (lc.includes("turnstile") || lc.includes("verify") || lc.includes("session") || lc.includes("human"))) {
            setTurnstileToken(null);
            setAnonSession(null);
            try { localStorage.removeItem(ANON_SESSION_KEY); } catch {}
          }
        } catch {}
        throw new Error(errMsg);
      }

      // Capture a freshly-issued anon session token (returned after Turnstile verify).
      const newAnonSession = response.headers.get("X-Anon-Session");
      if (newAnonSession) {
        setAnonSession(newAnonSession);
        try { localStorage.setItem(ANON_SESSION_KEY, newAnonSession); } catch {}
      }

      const data = await response.json();
      const content: string = data.choices?.[0]?.message?.content ?? "";

      if (jwt && latestUserContent && latestUserContent.length >= 20 && latestUserContent !== lastWrittenMemoryRef.current) {
        lastWrittenMemoryRef.current = latestUserContent;
        writeMemory(latestUserContent, jwt);
      }

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
          controller.enqueue(
            encoder.encode(
              `d:${JSON.stringify({
                finishReason: "stop",
                usage: data.usage ?? { promptTokens: 0, completionTokens: 0 },
              })}\n`
            )
          );
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
        },
      });
      },
    }),
  });

  // ── Persist messages into active thread ────────────────────────────────
  useEffect(() => {
    if (chat.messages.length === 0) return;
    setThreads((prev) => {
      if (!activeThreadId) return prev;
      const updated = prev.map((t) =>
        t.id === activeThreadId ? { ...t, messages: chat.messages } : t
      );
      saveThreads(updated);
      return updated;
    });
  }, [chat.messages, activeThreadId]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  // ── Thread helpers ───────────────────────────────────────────────────────
  const createNewThread = useCallback(() => {
    const newThread: Thread = {
      id: generateId(),
      title: "",
      createdAt: Date.now(),
      messages: [],
    };
    setThreads((prev) => {
      const updated = [newThread, ...prev];
      saveThreads(updated);
      return updated;
    });
    setActiveThreadId(newThread.id);
    try { localStorage.setItem(ACTIVE_THREAD_KEY, newThread.id); } catch {}
    chat.setMessages([]);
    setInput("");
    setMemoryActive(false);
  }, [chat]);

  // On first load with no active thread, create one
  useEffect(() => {
    if (!activeThreadId) {
      createNewThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectThread = useCallback(
    (thread: Thread) => {
      setActiveThreadId(thread.id);
      try { localStorage.setItem(ACTIVE_THREAD_KEY, thread.id); } catch {}
      chat.setMessages(thread.messages);
      setInput("");
      setMemoryActive(false);
    },
    [chat]
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => {
        const updated = prev.filter((t) => t.id !== threadId);
        saveThreads(updated);
        return updated;
      });
      if (threadId === activeThreadId) {
        createNewThread();
      }
    },
    [activeThreadId, createNewThread]
  );

  // ── Upgrade ──────────────────────────────────────────────────────────────
  async function handleUpgrade() {
    if (!jwt) {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/chat?upgrade=1" },
      });
      return;
    }
    setUpgrading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tag-pro-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Checkout failed");
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Upgrade error:", err);
    } finally {
      setUpgrading(false);
    }
  }

  function handleFileIngested(summary: string) {
    setPendingFileNote(summary);
  }

  const isEmpty = chat.messages.length === 0;

  // ── Derived ──────────────────────────────────────────────────────────────
  const canSend =
    chat.status !== "streaming" &&
    chat.status !== "submitted" &&
    input.trim().length > 0 &&
    (!!jwt || !!turnstileToken || !!anonSession);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Helmet>
        <title>Tag — Multi-Model Chat | hecz.dev</title>
        <meta
          name="description"
          content="Multi-model AI chat by hecz.dev. BYOK or use our free starter. Open source."
        />
        <meta property="og:title" content="Tag — Multi-Model Chat" />
        <meta property="og:description" content="Tag every model. Get the best answer." />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>

      {/* Root: full-viewport flex row — skin data attribute for CSS selectors */}
      <div className="flex h-screen overflow-hidden bg-background" data-skin={skin}>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "sidebar",
            "flex flex-col relative bg-card border-r border-border transition-all duration-200 shrink-0 overflow-hidden",
            sidebarOpen
              ? "w-56 lg:w-64"
              : "w-0 overflow-hidden",
            "fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto"
          )}
        >
          {/* ── Brick skin: tiled SVG wall behind sidebar content ── */}
          {skin === "brick" && (
            <div
              aria-hidden
              className="pointer-events-none select-none absolute inset-0 z-0"
              style={{
                backgroundImage: "url('/textures/brick-tile.svg')",
                backgroundRepeat: "repeat",
                backgroundSize: "160px 120px",
                opacity: 0.55,
              }}
            />
          )}
          {/* Gradient overlay so text stays readable on brick */}
          {skin === "brick" && (
            <div
              aria-hidden
              className="pointer-events-none select-none absolute inset-0 z-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(30 20% 95% / 0.72) 0%, hsl(30 20% 95% / 0.60) 100%)",
              }}
            />
          )}

          {/* All sidebar content sits above the decorative bg */}
          <div className="relative z-10 flex flex-col flex-1 min-h-0">
            {/* Sidebar header — logo + new chat */}
            <div className="flex flex-col items-center px-3 pt-5 pb-3 border-b border-border/60 gap-3">
              <div className="flex items-center justify-center w-full">
                <picture className="flex items-center justify-center motion-safe:animate-[breathe_3.5s_ease-in-out_infinite]">
                  <source srcSet="/logos/tag-graffiti.webp" type="image/webp" />
                  <img
                    src="/logos/tag-graffiti.png"
                    alt="Tag"
                    className="h-20 w-auto"
                  />
                </picture>
              </div>
              <button
                type="button"
                onClick={createNewThread}
                title="New conversation"
                aria-label="New conversation"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/50"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>New chat</span>
              </button>
            </div>

            {/* Threads label */}
            <div className="px-3 pt-3 pb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Conversations
              </span>
            </div>

            {/* Thread list */}
            <nav className="flex-1 overflow-y-auto px-1.5 pb-4">
              {threads.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground/50">No conversations yet.</p>
              ) : (
                <ul>
                  {threads.map((thread) => (
                    <ThreadRow
                      key={thread.id}
                      thread={thread}
                      active={thread.id === activeThreadId}
                      onSelect={() => selectThread(thread)}
                      onDelete={() => deleteThread(thread.id)}
                    />
                  ))}
                </ul>
              )}
            </nav>

            {/* Sidebar footer tagline */}
            <div className="px-3 pb-3 border-t border-border/40 pt-2">
              <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                Tag every model.
                <br />
                Get the best answer.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* ── Main column ────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <header className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border bg-card shrink-0">
            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setSidebarOpen((s) => !s)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {/* View toggle pills */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setView("chat")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  view === "chat"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setView("compare")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  view === "compare"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Compare
                {tier !== "pro" && <Lock className="h-3 w-3" />}
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Model picker — only in chat mode */}
            {view === "chat" && <ModelPicker value={model} onChange={setModel} onUpgrade={handleUpgrade} />}

            {/* Memory indicator + toggle */}
            {jwt && view === "chat" && (
              <button
                type="button"
                onClick={() => setMemoryDrawerOpen((o) => !o)}
                title="Memory panel"
                aria-label="Toggle memory panel"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors",
                  memoryActive
                    ? "text-primary bg-primary/10 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">
                  {memoryActive ? "Memory on" : "Memory"}
                </span>
              </button>
            )}

            {/* BYOK keys */}
            <button
              type="button"
              onClick={() => setByokOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Key className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px]">Keys</span>
            </button>

            {/* Skin picker — Palette icon, always visible */}
            <SkinPicker skin={skin} onChange={setSkin} />

            {/* Upgrade — only for free signed-in users */}
            {jwt && tier !== "pro" && (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgrading}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Crown className="h-3 w-3" />
                <span className="hidden sm:inline">{upgrading ? "Redirecting…" : "$7/mo"}</span>
              </button>
            )}
          </header>

          {/* Content area: compare mode or chat */}
          {view === "compare" ? (
            <div className="flex-1 overflow-y-auto p-4">
              <CompareView
                jwt={jwt}
                tier={tier}
                byokKeys={byokKeys}
                onUpgrade={handleUpgrade}
              />
            </div>
          ) : (
            /* Chat layout: messages + memory panel */
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Message column */}
              <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

                {/* Scrollable message feed — canvas panel with hero watermark */}
                <div className="relative flex-1 overflow-y-auto">

                  {/* ── Hero watermark — top-right (paper / canvas / brick skins) ── */}
                  {skin !== "editorial" && (
                    <div
                      aria-hidden
                      className={cn(
                        "hero-watermark",
                        "pointer-events-none select-none",
                        "absolute top-0 right-0 z-[1]",
                        // Hide on small screens
                        "hidden lg:block",
                        // Canvas skin gets the breathing animation
                        skin === "canvas" && "motion-safe:animate-[tag-breathe_4s_ease-in-out_infinite]"
                      )}
                      style={{ maxHeight: "50vh" }}
                    >
                      <picture>
                        <source srcSet="/logos/tag-graffiti.webp" type="image/webp" />
                        <img
                          src="/logos/tag-graffiti.png"
                          alt=""
                          className="opacity-[0.12] h-[50vh] w-auto object-contain"
                          draggable={false}
                        />
                      </picture>
                    </div>
                  )}

                  {/* ── Editorial skin: rotated vertical watermark on left edge ── */}
                  {skin === "editorial" && (
                    <div
                      aria-hidden
                      className={cn(
                        "hero-watermark",
                        "pointer-events-none select-none",
                        "absolute left-0 top-1/2 z-[1]",
                        "hidden lg:block",
                        "-translate-y-1/2 -translate-x-[38%]"
                      )}
                      style={{ transformOrigin: "center center" }}
                    >
                      <picture>
                        <source srcSet="/logos/tag-graffiti.webp" type="image/webp" />
                        <img
                          src="/logos/tag-graffiti.png"
                          alt=""
                          className="opacity-[0.09] h-[42vh] w-auto object-contain"
                          style={{ transform: "rotate(-90deg)" }}
                          draggable={false}
                        />
                      </picture>
                    </div>
                  )}

                  {/* ── Bottom-left splatter motif (all skins) ── */}
                  <div
                    aria-hidden
                    className="pointer-events-none select-none absolute bottom-4 left-4 z-[1] hidden lg:block"
                  >
                    <svg
                      width="96"
                      height="96"
                      viewBox="0 0 80 80"
                      fill="none"
                      aria-hidden
                      className="opacity-25"
                    >
                      <ellipse cx="40" cy="42" rx="18" ry="16" fill="#8B7DA8" opacity="0.25" />
                      <ellipse cx="40" cy="41" rx="11" ry="10" fill="#8B7DA8" opacity="0.45" />
                      <circle cx="22" cy="30" r="3.5" fill="#8B7DA8" opacity="0.3" />
                      <circle cx="58" cy="28" r="2.5" fill="#8B7DA8" opacity="0.25" />
                      <circle cx="62" cy="50" r="4"   fill="#8B7DA8" opacity="0.2" />
                      <circle cx="18" cy="54" r="3"   fill="#8B7DA8" opacity="0.2" />
                      <circle cx="32" cy="18" r="2"   fill="#B0A3C4" opacity="0.4" />
                      <circle cx="52" cy="62" r="2.5" fill="#B0A3C4" opacity="0.35" />
                      <circle cx="66" cy="36" r="2"   fill="#5EEAD4" opacity="0.5" />
                      <circle cx="14" cy="38" r="1.5" fill="#5EEAD4" opacity="0.4" />
                      <circle cx="44" cy="10" r="1.5" fill="#5EEAD4" opacity="0.35" />
                    </svg>
                  </div>

                  {/* Messages — above all decorations */}
                  <div className="relative z-10">
                    <div className="mx-auto w-full max-w-2xl px-4 py-6">
                      {isEmpty ? (
                        <EmptyState />
                      ) : (
                        <div className="flex flex-col gap-6">
                          {chat.messages.map((msg) => {
                            const content = msg.parts
                              ? msg.parts
                                  .filter((p) => p.type === "text")
                                  .map((p) => ("text" in p ? p.text : ""))
                                  .join("")
                              : msg.content;

                            if (msg.role === "user") {
                              return (
                                <div key={msg.id} className="flex items-end justify-end gap-2.5">
                                  <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed whitespace-pre-wrap">
                                    {content}
                                  </div>
                                  <div className="h-7 w-7 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary uppercase">
                                    {userId ? userId.slice(0, 1) : "Y"}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={msg.id} className="flex items-start gap-2.5">
                                <div className="h-7 w-7 shrink-0 rounded-full bg-muted border border-border/60 flex items-center justify-center overflow-hidden mt-0.5">
                                  <picture>
                                    <source srcSet="/logos/tag-graffiti.webp" type="image/webp" />
                                    <img
                                      src="/logos/tag-graffiti.png"
                                      alt="Tag"
                                      className="h-6 w-6 mix-blend-multiply"
                                    />
                                  </picture>
                                </div>
                                <div className="flex-1 min-w-0 text-sm text-foreground leading-relaxed">
                                  <Suspense fallback={<span className="text-muted-foreground text-xs">…</span>}>
                                    <MessageContent content={content} />
                                  </Suspense>
                                </div>
                              </div>
                            );
                          })}
                          {(chat.status === "streaming" || chat.status === "submitted") && (
                            <div className="flex items-center gap-2.5 pl-9">
                              <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce"
                                    style={{ animationDelay: `${i * 0.12}s` }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>

                {/* Error banner — relative z-10 so the hero watermark (z-1) doesn't cover it */}
                {chat.error && (
                  <div className="relative z-10 mx-4 mb-2 rounded-md border border-destructive bg-destructive/10 px-4 py-3">
                    <p className="text-sm text-destructive">{chat.error.message}</p>
                  </div>
                )}

                {/* Turnstile gate — relative z-10 for same reason. Without this the
                    watermark (absolute top-0 right-0 max-h-50vh z-1) visually covers
                    the gate's render area, leaving anon users with no widget to click.
                    Hidden once the user has a valid anon session or in-memory token. */}
                {!jwt && !turnstileToken && !anonSession && (
                  <div className="relative z-10 mx-4 mb-2">
                    <TurnstileGate onToken={setTurnstileToken} />
                  </div>
                )}

                {/* Sticky composer */}
                <div className="shrink-0 border-t border-border bg-card px-4 py-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!input.trim()) return;
                      if (!activeThreadId) createNewThread();
                      chat.sendMessage({ text: input });
                      setInput("");
                    }}
                    className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm focus-within:border-primary/50 transition-colors"
                  >
                    <textarea
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 leading-relaxed max-h-40"
                      placeholder={
                        !jwt && !turnstileToken && !anonSession
                          ? "Complete verification above to chat…"
                          : "Message Tag…"
                      }
                      rows={1}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                      }}
                      disabled={!jwt && !turnstileToken && !anonSession}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!canSend) return;
                          if (!activeThreadId) createNewThread();
                          chat.sendMessage({ text: input });
                          setInput("");
                          (e.target as HTMLTextAreaElement).style.height = "auto";
                        }
                      }}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <FileDropzone
                        jwt={jwt}
                        tier={tier}
                        onIngested={handleFileIngested}
                      />
                      <button
                        type="submit"
                        disabled={!canSend}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30 hover:opacity-90"
                        aria-label="Send message"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Memory panel */}
              {memoryDrawerOpen && jwt && (
                <div className="flex w-72 shrink-0 flex-col border-l border-border bg-card overflow-y-auto">
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      Memory
                    </span>
                    <button
                      type="button"
                      onClick={() => setMemoryDrawerOpen(false)}
                      aria-label="Close memory panel"
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="px-3 pb-4">
                    <MemoryPanel jwt={jwt} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drawers — mounted outside layout */}
      <BYOKDrawer
        open={byokOpen}
        onClose={() => setByokOpen(false)}
        onKeysChange={setByokKeys}
      />
    </>
  );
}
