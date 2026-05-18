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
  LogIn,
  Menu,
  MessageSquarePlus,
  Send,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelPicker, MODELS } from "@/components/chat/ModelPicker";
import { BYOKDrawer, readBYOKKeys } from "@/components/chat/BYOKDrawer";
import { AccountDrawer } from "@/components/chat/AccountDrawer";
import { TurnstileGate } from "@/components/chat/TurnstileGate";
import { MemoryPanel } from "@/components/chat/MemoryPanel";
import { CompareView } from "@/components/chat/CompareView";
import { AgentView } from "@/components/chat/AgentView";
import { FileDropzone } from "@/components/chat/FileDropzone";
import { SkinPicker, useChatSkin } from "@/components/chat/SkinPicker";
import type { Message } from "@ai-sdk/react";

const MessageContent = lazy(() => import("@/components/chat/MessageContent"));

// ---------------------------------------------------------------------------
// Pro welcome modal
// ---------------------------------------------------------------------------

const PRO_WELCOMED_KEY = "tag_pro_welcomed_v1";

function ProWelcomeModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] animate-[pro-fade-in_0.25s_ease-out]"
        aria-hidden
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="You're on Pro"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-[pro-slide-up_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
          {/* Confetti burst — pure CSS SVG, fades out after 2.5 s */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 w-full h-full motion-safe:animate-[pro-confetti_2.5s_ease-out_forwards]"
            viewBox="0 0 400 260"
            fill="none"
          >
            {/* scattered dots in brand colours */}
            <circle cx="60"  cy="30"  r="5" fill="#8B7DA8" opacity="0.9" />
            <circle cx="120" cy="15"  r="4" fill="#B0A3C4" opacity="0.8" />
            <circle cx="200" cy="10"  r="6" fill="#8B7DA8" opacity="0.85" />
            <circle cx="280" cy="18"  r="4" fill="#5EEAD4" opacity="0.8" />
            <circle cx="340" cy="28"  r="5" fill="#B0A3C4" opacity="0.75" />
            <circle cx="40"  cy="70"  r="3" fill="#5EEAD4" opacity="0.7" />
            <circle cx="360" cy="65"  r="3" fill="#8B7DA8" opacity="0.7" />
            <circle cx="90"  cy="50"  r="3" fill="#B0A3C4" opacity="0.65" />
            <circle cx="310" cy="45"  r="4" fill="#5EEAD4" opacity="0.6" />
            <rect   x="155" y="8"  width="6" height="6" rx="1" fill="#8B7DA8" opacity="0.8" transform="rotate(20 155 8)" />
            <rect   x="240" y="12" width="5" height="5" rx="1" fill="#5EEAD4" opacity="0.75" transform="rotate(-15 240 12)" />
            <rect   x="78"  y="38" width="4" height="4" rx="1" fill="#B0A3C4" opacity="0.7" transform="rotate(35 78 38)" />
            <rect   x="320" y="55" width="5" height="5" rx="1" fill="#8B7DA8" opacity="0.65" transform="rotate(-25 320 55)" />
          </svg>

          {/* Header strip */}
          <div className="flex items-center gap-3 bg-primary px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
              <Crown className="h-5 w-5 text-primary-foreground" />
            </span>
            <h2
              className="text-xl font-bold text-primary-foreground"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              You're on Pro.
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <ul className="space-y-2.5 text-sm text-foreground">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span><strong>Premium models unlocked</strong> — Kimi-K2.6, GLM-5.1, MiniMax-M2.5, Nemotron.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span><strong>Multi-model compare</strong> — run the same prompt across models side-by-side.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span><strong>File uploads</strong> — drop in a doc and chat with its contents.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span><strong>Memory</strong> — context that follows you across sessions.</span>
              </li>
            </ul>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

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
  // 3s timeout — memory search is a nice-to-have, must NEVER block the chat
  // send. Before the timeout, a hanging mem0-search hung the entire fetch
  // wrapper and produced "no reply" for the signed-in user. Worst case now:
  // memory injection skipped, chat still streams.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mem0-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ query, limit: 5 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.memories as Mem0Memory[]) ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
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

const STARTER_PROMPTS = [
  "Explain quantum computing",
  "Debug this JavaScript error",
  "Plan a weekend in Chicago",
  "Compare React vs Vue",
  "Write a haiku about shipping",
  "Summarize a topic for me",
];

interface EmptyStateProps {
  onPickPrompt: (prompt: string) => void;
}

function EmptyState({ onPickPrompt }: EmptyStateProps) {
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

      {/* Starter prompt pills — set input but do not auto-send */}
      <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg px-4">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPickPrompt(prompt)}
            className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs text-foreground hover:bg-primary/15 transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {prompt}
          </button>
        ))}
      </div>
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
  // Text the user tried to send when the anon gate rejected the request.
  // We cache it so the next captured Turnstile token can auto-resend it
  // instead of forcing the user to retype.
  const pendingAnonResendRef = useRef<string | null>(null);
  const [memoryActive, setMemoryActive] = useState(false);
  const [view, setView] = useState<"chat" | "compare" | "agent">("chat");
  const [pendingFileNote, setPendingFileNote] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  // Track if user has actively sent during THIS session — guards the error banner
  // against stale chat.error rehydrated from restored threads on page mount.
  const hasSentThisSessionRef = useRef(false);

  // Mirror state to refs so the chat transport (constructed ONCE on mount)
  // can read live values at request time instead of capturing stale snapshots.
  // Without this, jwt/turnstileToken/anonSession/model captured on first render
  // (when Supabase Auth was still resolving) get baked into the transport and
  // every send goes out as anon-with-no-token → 400 "Verify you are human".
  const jwtRef = useRef(jwt);
  const turnstileTokenRef = useRef(turnstileToken);
  const anonSessionRef = useRef(anonSession);
  const modelRef = useRef(model);
  useEffect(() => { jwtRef.current = jwt; }, [jwt]);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);
  useEffect(() => { anonSessionRef.current = anonSession; }, [anonSession]);
  useEffect(() => { modelRef.current = model; }, [model]);
  // Mirror more state to refs so the fetch wrapper closure (created once)
  // reads live values at request time, not the values present at mount.
  // Memory injection + BYOK + pending file note were silently broken because
  // they read closed-over jwt=null / byokKeys={} / pendingFileNote=null.
  const byokKeysRef = useRef(byokKeys);
  const pendingFileNoteRef = useRef(pendingFileNote);
  useEffect(() => { byokKeysRef.current = byokKeys; }, [byokKeys]);
  useEffect(() => { pendingFileNoteRef.current = pendingFileNote; }, [pendingFileNote]);
  const [showProWelcome, setShowProWelcome] = useState(() => {
    try {
      if (localStorage.getItem(PRO_WELCOMED_KEY)) return false;
      return new URLSearchParams(window.location.search).get("pro") === "success";
    } catch {
      return false;
    }
  });

  // ── Sidebar / thread state ──────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024; // lg: breakpoint
  });
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_THREAD_KEY); } catch { return null; }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastWrittenMemoryRef = useRef<string>("");

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Refresh stale access tokens on mount. Supabase auto-refresh in the
    // background does not always run after tab inactivity, so we kick it
    // explicitly to avoid users returning to /chat with an expired JWT and
    // getting "Invalid or expired JWT" from the proxy.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Token close to expiry → refresh proactively. Supabase access tokens
        // default to 1 hour; if more than 50 minutes elapsed since issuance,
        // refresh.
        const expiresAt = (data.session.expires_at ?? 0) * 1000;
        const timeLeftMs = expiresAt - Date.now();
        if (timeLeftMs < 10 * 60 * 1000) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session) {
            setUserId(refreshed.session.user?.id ?? null);
            setJwt(refreshed.session.access_token ?? null);
            return;
          }
        }
        setUserId(data.session.user?.id ?? null);
        setJwt(data.session.access_token ?? null);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
      setJwt(session?.access_token ?? null);
      // On a fresh sign-in (post-OAuth), kill any lingering "Session expired"
      // banner immediately rather than waiting for the next render cycle.
      // SIGNED_IN fires both on initial auth and on token refresh.
      if (event === "SIGNED_IN") {
        setShowError(false);
        hasSentThisSessionRef.current = false;
      }
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

  // Auto-open the account drawer when arriving with ?account=1 — covers the
  // redirect from the deprecated /chat/account route + external deep links.
  useEffect(() => {
    if (!jwt) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("account") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      setAccountDrawerOpen(true);
    }
  }, [jwt]);

  // ── Pro welcome: auto-dismiss after 6 s, clean URL, persist flag ────────
  useEffect(() => {
    if (!showProWelcome) return;
    // Persist so re-load with the same URL doesn't re-show
    try { localStorage.setItem(PRO_WELCOMED_KEY, "1"); } catch {}
    // Clear ?pro=success from URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete("pro");
    window.history.replaceState({}, "", url.toString());
    // Auto-dismiss after 6 s
    const timer = setTimeout(() => setShowProWelcome(false), 6000);
    return () => clearTimeout(timer);
  }, [showProWelcome]);

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
      // Functions are evaluated at request time, reading the latest ref values.
      // Object form would capture the values at transport-construction time
      // (initial mount), before Supabase Auth resolves the session.
      headers: () =>
        jwtRef.current ? { Authorization: `Bearer ${jwtRef.current}` } : {},
      body: () => ({
        model: modelRef.current,
        turnstile_token: jwtRef.current ? undefined : turnstileTokenRef.current,
        anon_session_token: jwtRef.current ? undefined : anonSessionRef.current,
      }),
      fetch: async (input, init) => {
      // Read all state via refs — transport is created once on mount and the
      // closure would otherwise capture initial-render values (null jwt,
      // default model, empty byokKeys) forever, silently breaking memory,
      // model selection, BYOK, and file-note injection for any state set
      // after first render.
      const liveJwt = jwtRef.current;
      const liveModel = modelRef.current;
      const liveByokKeys = byokKeysRef.current;
      const livePendingFileNote = pendingFileNoteRef.current;
      const reqBody = init?.body ? JSON.parse(init.body as string) : {};
      // Diagnostic — exposes whether the send is even firing and with what
      // identity. If signed-in chats stop working again, the user can paste
      // this from the browser console to give us instant insight.
      console.debug("[Tag chat] send:", {
        signedIn: !!liveJwt,
        model: liveModel,
        msgCount: (reqBody.messages ?? []).length,
        hasFileNote: !!livePendingFileNote,
      });

      // AI SDK v6 sends UIMessages: { role, parts: [{ type:"text", text:"..." }] }.
      // synthetic.new (OpenAI-compatible) requires { role, content: string }.
      // Normalize: flatten parts[*].text into content, or pass through if the
      // message is already in legacy { role, content } shape.
      // deno-lint-ignore no-explicit-any
      const rawMessages: Array<any> = reqBody.messages ?? [];
      const messages: Array<{ role: string; content: string }> = rawMessages.map((m) => {
        if (typeof m?.content === "string" && m.content.length > 0) {
          return { role: m.role, content: m.content };
        }
        if (Array.isArray(m?.parts)) {
          const text = m.parts
            // deno-lint-ignore no-explicit-any
            .filter((p: any) => p?.type === "text" && typeof p.text === "string")
            // deno-lint-ignore no-explicit-any
            .map((p: any) => p.text)
            .join("");
          return { role: m.role, content: text };
        }
        return { role: m.role, content: "" };
      }).filter((m) => m.content.length > 0);
      const latestUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const latestUserContent = latestUserMsg?.content ?? "";

      let finalMessages = messages;
      if (livePendingFileNote) {
        const fileNoteMsg = {
          role: "system",
          content: `[File just uploaded] ${livePendingFileNote} The file's content has been stored in your memory and is available for retrieval.`,
        };
        finalMessages = [fileNoteMsg, ...finalMessages];
        setPendingFileNote(null);
      }

      if (liveJwt && latestUserContent) {
        // Hard 3.5s ceiling on memory injection — even if the in-function
        // abort doesn't kick in (e.g. network stack swallows signal), this
        // Promise.race guarantees we move on. Memory is best-effort decoration,
        // never a gate.
        const memories: Mem0Memory[] = await Promise.race([
          searchMemories(latestUserContent, liveJwt),
          new Promise<Mem0Memory[]>((resolve) => setTimeout(() => resolve([]), 3500)),
        ]);
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
      for (const [provider, key] of Object.entries(liveByokKeys)) {
        if (key && liveByokKeys[provider]) {
          if (provider === "synthetic" && liveModel.startsWith("hf:")) {
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
      if (!activeBYOKProvider && liveModel.startsWith("hf:") && liveByokKeys["synthetic"]) {
        activeBYOKProvider = "synthetic";
        activeBYOKKey = liveByokKeys["synthetic"];
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
            model: liveModel,
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
            model: liveModel,
            byok_provider: activeBYOKProvider,
          }),
        });
      } else {
        response = await fetch(input as RequestInfo, {
          ...init,
          body: JSON.stringify({ ...reqBody, messages: finalMessages, model: liveModel }),
        });
      }

      // On 401 from Supabase gateway (expired JWT), try refreshing the session
      // once and retry the request. If refresh succeeds, the new JWT lands in
      // jwtRef via the auth state change listener before we re-fetch.
      if (response.status === 401 && jwtRef.current) {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed.session?.access_token) {
            jwtRef.current = refreshed.session.access_token;
            setJwt(refreshed.session.access_token);
            // Reissue the request with the refreshed JWT in the header.
            const retryHeaders = new Headers(init?.headers as HeadersInit | undefined);
            retryHeaders.set("Authorization", `Bearer ${refreshed.session.access_token}`);
            response = await fetch(input as RequestInfo, {
              ...init,
              headers: retryHeaders,
              body: JSON.stringify({ ...reqBody, messages: finalMessages, model: liveModel }),
            });
          }
        } catch {
          // refresh failed — fall through to error path
        }
      }

      if (!response.ok) {
        let errMsg = "Chat request failed";
        try {
          const errData = await response.json();
          errMsg = errData?.error ?? errMsg;

          // If proxy returns an upstream-failure envelope, surface the upstream
          // status + a short snippet of the upstream body so the user (and us)
          // can actually diagnose the failure. Without this, "upstream error"
          // is a dead end.
          if (errMsg === "upstream error") {
            const upstreamStatus = errData?.status;
            const detail = errData?.detail;
            let detailMsg = "";
            if (detail) {
              if (typeof detail === "string") {
                detailMsg = detail.slice(0, 200);
              } else if (detail.error?.message) {
                detailMsg = String(detail.error.message).slice(0, 200);
              } else if (detail.message) {
                detailMsg = String(detail.message).slice(0, 200);
              } else {
                detailMsg = JSON.stringify(detail).slice(0, 200);
              }
            }
            errMsg = `Upstream ${upstreamStatus ?? "error"}${detailMsg ? `: ${detailMsg}` : " — no detail returned"}`;
          }

          // Clear stale anon session on any auth-related 400 so the user isn't
          // stuck in a loop. Server returns "Verify you are human…" for expired
          // sessions which doesn't contain "turnstile" — match broader set.
          const lc = errMsg.toLowerCase();
          if (!jwtRef.current && (lc.includes("turnstile") || lc.includes("verify") || lc.includes("session") || lc.includes("human"))) {
            setTurnstileToken(null);
            setAnonSession(null);
            try { localStorage.removeItem(ANON_SESSION_KEY); } catch {}
            // Cache the user's text so we can auto-resend it as soon as the
            // Turnstile gate returns a new token — saves the user from
            // retyping after every gate prompt.
            if (latestUserContent) {
              pendingAnonResendRef.current = latestUserContent;
            }
          }
          // On 401 with stale JWT that wouldn't refresh: surface the banner
          // and let the user click "Sign in again" which initiates a fresh
          // OAuth round-trip. We deliberately DO NOT auto-signOut here —
          // the previous implementation raced with refreshSession and left
          // the page in a "spam Session expired even after re-login" loop.
          if (response.status === 401 && lc.includes("jwt")) {
            // If the proxy gave us a specific reason (e.g. "JWT expired",
            // "signature invalid"), append it so we can debug without
            // opening DevTools. Empty reason = legacy proxy or unknown.
            const reason = errData?.reason;
            errMsg = reason
              ? `Session expired (${reason}). Please sign in again.`
              : "Your session expired. Please sign in again.";
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

      if (liveJwt && latestUserContent && latestUserContent.length >= 20 && latestUserContent !== lastWrittenMemoryRef.current) {
        lastWrittenMemoryRef.current = latestUserContent;
        writeMemory(latestUserContent, liveJwt);
      }

      // AI SDK v6 UI Message Stream protocol — SSE with typed JSON events.
      // The legacy v3 data-stream format (0:..., d:...) is silently ignored by
      // v6, which is why assistant bubbles came back empty.
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const textId = `text-${Date.now()}`;
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (obj: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          send({ type: "start", messageId });
          send({ type: "start-step" });
          send({ type: "text-start", id: textId });
          if (content) send({ type: "text-delta", id: textId, delta: content });
          send({ type: "text-end", id: textId });
          send({ type: "finish-step" });
          send({ type: "finish" });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      });
      },
    }),
  });

  // Auto-resend a previously failed anon message once a fresh Turnstile token
  // (or anon session) arrives. Without this, every gate prompt eats the
  // user's text and forces them to retype.
  useEffect(() => {
    if (!turnstileToken && !anonSession) return;
    const pending = pendingAnonResendRef.current;
    if (!pending) return;
    if (chat.status === "streaming" || chat.status === "submitted") return;
    pendingAnonResendRef.current = null;
    hasSentThisSessionRef.current = true;
    chat.sendMessage({ text: pending });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnstileToken, anonSession]);

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

  // ── Error banner visibility: show on new error AFTER user has actively sent
  // this session. Without the hasSent guard, rehydrated chat.error from old
  // restored threads would show the banner on every page load. Cleared when
  // streaming starts on the next attempt.
  useEffect(() => {
    if (chat.error && hasSentThisSessionRef.current) {
      setShowError(true);
    }
  }, [chat.error]);

  useEffect(() => {
    if (chat.status === "streaming" || chat.status === "submitted") {
      setShowError(false);
    }
  }, [chat.status]);

  // Note: previous versions had a jwt-change useEffect here that dropped
  // trailing user messages and cleared showError on any jwt transition.
  // It caused signed-in chat to silently fail in ways that were hard to
  // reproduce. Removed in favor of:
  //   1. SIGNED_IN auth event handler clears showError (line ~462)
  //   2. The fetch wrapper's 401 path no longer auto-signOuts
  //   3. User can manually dismiss the banner via the X button
  // The orphan failed message is a minor UX wart, not worth the bug surface.

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
        const body = await res.json().catch(() => ({}));
        const code: string = body?.error ?? "";
        const msg =
          code === "already_subscribed"
            ? "You're already a Pro subscriber."
            : code
            ? code.replace(/_/g, " ")
            : "Checkout failed. Please try again.";
        throw new Error(msg);
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      setUpgradeError(msg);
      setTimeout(() => setUpgradeError(null), 8000);
    } finally {
      setUpgrading(false);
    }
  }

  function handleFileIngested(summary: string) {
    setPendingFileNote(summary);
  }

  const isEmpty = chat.messages.length === 0;

  // ── Starter prompt pick — sets input and focuses textarea; does not send ──
  function handlePickPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  // Anon now allowed unconditionally (IP rate limit + Cloudflare DDoS in front
  // of Supabase replaces the per-message Turnstile gate).
  const canSend =
    chat.status !== "streaming" &&
    chat.status !== "submitted" &&
    input.trim().length > 0;

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

            {/* Sidebar footer — Login / Account + hecz.dev mini-nav + tagline */}
            <div className="px-3 pb-3 border-t border-border/40 pt-2 space-y-2">
              {jwt ? (
                <button
                  type="button"
                  onClick={() => setAccountDrawerOpen(true)}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                    {userId?.slice(0, 1).toUpperCase() ?? "•"}
                  </span>
                  <span className="truncate flex-1">
                    Account {tier === "pro" && <span className="text-primary font-medium">· Pro</span>}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: { redirectTo: window.location.origin + "/chat" },
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Login
                </button>
              )}

              {/* hecz.dev mini-nav — small, unobtrusive, cross-surface links */}
              <div className="flex items-center gap-3 px-2 pt-1 text-[10px] text-muted-foreground/60">
                <a href="/" className="hover:text-foreground transition-colors">hecz.dev</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/learn" className="hover:text-foreground transition-colors">Learn</a>
              </div>

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
              <button
                type="button"
                onClick={() => {
                  if (tier !== "pro") { handleUpgrade(); return; }
                  setView("agent");
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  view === "agent"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Terminal className="h-3 w-3" />
                Agent
                {tier !== "pro" && <Lock className="h-3 w-3" />}
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Model picker — only in chat mode; agent picks its own model */}
            {view === "chat" && <ModelPicker value={model} onChange={setModel} onUpgrade={handleUpgrade} tier={tier} />}

            {/* Memory indicator + toggle — only in chat mode */}
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

          {/* Upgrade error alert — auto-dismissed after 8 s */}
          {upgradeError && (
            <div
              role="alert"
              className="mx-4 mt-2 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
            >
              <span>{upgradeError}</span>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className="text-xs font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Try again
                </button>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setUpgradeError(null)}
                  className="text-destructive/60 hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Content area: compare / agent / chat */}
          {view === "compare" ? (
            <div className="flex-1 overflow-y-auto p-4">
              <CompareView
                jwt={jwt}
                tier={tier}
                byokKeys={byokKeys}
                onUpgrade={handleUpgrade}
              />
            </div>
          ) : view === "agent" ? (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <AgentView jwt={jwt} tier={tier} onUpgrade={handleUpgrade} />
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
                        "absolute top-1/2 z-[1]",
                        "hidden lg:block",
                        "-translate-y-1/2 -rotate-90"
                      )}
                      style={{ left: "-140px" }}
                    >
                      <picture>
                        <source srcSet="/logos/tag-graffiti.webp" type="image/webp" />
                        <img
                          src="/logos/tag-graffiti.png"
                          alt=""
                          className="opacity-[0.09] h-[42vh] w-auto object-contain"
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
                        <EmptyState onPickPrompt={handlePickPrompt} />
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

                {/* Error banner — classified by the message text so we can
                    show brand-aligned copy + a recovery CTA instead of a flat
                    red rectangle. relative z-10 so the hero watermark (z-1)
                    doesn't cover it. showError clears as the next send streams. */}
                {chat.error && showError && (() => {
                  const raw = chat.error.message ?? "";
                  const lc = raw.toLowerCase();
                  const isQuota = lc.includes("quota") || lc.includes("daily limit") || lc.includes("rate limit");
                  const isUpstream = lc.startsWith("upstream") || lc.includes("upstream error");
                  const isAuth = lc.includes("jwt") || lc.includes("session expired") || lc.includes("sign in again");
                  const isModel = lc.includes("model not allowed") || lc.includes("not allowed for your tier");

                  const headline = isQuota
                    ? (jwt ? (tier === "pro" ? "You hit today's premium cap." : "Daily messages used up.") : "Anon daily limit hit.")
                    : isUpstream ? "Upstream model hiccup."
                    : isAuth    ? "Session expired."
                    : isModel   ? "That model's behind the Pro paywall."
                    :             "Something went sideways.";

                  const subline = isQuota
                    ? (jwt
                        ? (tier === "pro"
                            ? "Resets at midnight UTC. Or bring your own key for unlimited."
                            : "Upgrade to Pro for 50 standard + 100 premium messages a day.")
                        : "Sign in (free) for 50/day and persistent memory.")
                    : isUpstream ? "Synthetic.new burped. Retry usually works."
                    : isAuth    ? "Sign in again to keep chatting."
                    : isModel   ? "Upgrade to Pro to unlock it, or pick a free model."
                    :             raw.slice(0, 240);

                  return (
                    <div className="relative z-10 mx-4 mb-2 overflow-hidden rounded-lg border border-destructive/30 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent">
                      {/* Brand splatter accent — tiny, top-right */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/20 blur-2xl"
                      />
                      <div className="relative flex items-start gap-3 px-4 py-3 pr-10">
                        <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                          <span className="font-mono text-[11px]">!</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {headline}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                            {subline}
                          </p>

                          {/* Action row — contextual recovery CTA */}
                          {(isQuota && (!jwt || tier !== "pro")) || isModel ? (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              {!jwt ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await supabase.auth.signInWithOAuth({
                                      provider: "google",
                                      options: { redirectTo: window.location.origin + "/chat" },
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90 transition-opacity"
                                >
                                  <LogIn className="h-3 w-3" />
                                  Sign in — free
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleUpgrade}
                                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                                >
                                  <Crown className="h-3 w-3" />
                                  Upgrade to Pro · $7/mo
                                </button>
                              )}
                              <a
                                href="/chat/pricing"
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                              >
                                Compare plans
                              </a>
                            </div>
                          ) : isAuth ? (
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await supabase.auth.signInWithOAuth({
                                    provider: "google",
                                    options: { redirectTo: window.location.origin + "/chat" },
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90 transition-opacity"
                              >
                                <LogIn className="h-3 w-3" />
                                Sign in again
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowError(false)}
                          aria-label="Dismiss"
                          className="absolute right-2 top-2 rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Turnstile gate removed (T3-style anon flow). Anon users
                    can chat immediately; IP rate limit (10/day) is the only
                    anti-abuse. Login CTA in sidebar handles the upgrade
                    funnel. */}

                {/* Sticky composer */}
                <div className="shrink-0 border-t border-border bg-card px-4 py-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!input.trim()) return;
                      if (!activeThreadId) createNewThread();
                      hasSentThisSessionRef.current = true;
                      chat.sendMessage({ text: input });
                      setInput("");
                    }}
                    className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm focus-within:border-primary/50 transition-colors"
                  >
                    <textarea
                      ref={textareaRef}
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 leading-relaxed max-h-40"
                      placeholder="Message Tag…"
                      rows={1}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!canSend) return;
                          if (!activeThreadId) createNewThread();
                          hasSentThisSessionRef.current = true;
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

      <AccountDrawer
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        jwt={jwt}
        userId={userId}
        tier={tier}
        onUpgrade={() => { setAccountDrawerOpen(false); handleUpgrade(); }}
      />

      {/* Pro welcome modal — shown once after checkout return */}
      {showProWelcome && (
        <ProWelcomeModal onDismiss={() => setShowProWelcome(false)} />
      )}
    </>
  );
}
