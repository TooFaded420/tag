import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Helmet } from "react-helmet-async";
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BookMarked,
  Bookmark,
  BookmarkX,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crown,
  Download,
  Eye,
  EyeOff,
  GitFork,
  Key,
  Layout,
  Lock,
  LogIn,
  Menu,
  MessageSquarePlus,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Share2,
  Square,
  Terminal,
  Thermometer,
  Trash2,
  Upload,
  X,
  SearchCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelPicker, MODELS } from "@/components/chat/ModelPicker";
import { BYOKDrawer, readBYOKKeys } from "@/components/chat/BYOKDrawer";
import { AccountDrawer } from "@/components/chat/AccountDrawer";
import { WorkspaceSwitcher } from "@/components/chat/WorkspaceSwitcher";
import { InviteDialog } from "@/components/chat/InviteDialog";
import { TurnstileGate } from "@/components/chat/TurnstileGate";
import { MemoryPanel } from "@/components/chat/MemoryPanel";
import { IntegrationsPanel, readComposioKey } from "@/components/chat/IntegrationsPanel";
import { AgentActivityLog } from "@/components/chat/AgentActivityLog";
import { NotificationCenter } from "@/components/chat/NotificationCenter";
import { UsageDashboard } from "@/components/chat/UsageDashboard";
import { ScheduledPromptsPanel } from "@/components/chat/ScheduledPromptsPanel";
import { CompareView } from "@/components/chat/CompareView";
import { AgentView } from "@/components/chat/AgentView";
import { FileDropzone } from "@/components/chat/FileDropzone";
import type { PendingImage } from "@/components/chat/FileDropzone";
import { SkinPicker, useChatSkin } from "@/components/chat/SkinPicker";
import { MicButton, TTSButton } from "@/components/chat/VoiceControls";
import type { Message } from "@ai-sdk/react";

const MessageContent = lazy(() => import("@/components/chat/MessageContent"));
import { ImageBubble } from "@/components/chat/ImageBubble";

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
const IMAGE_PROXY_URL = `${SUPABASE_URL}/functions/v1/synthetic-image-proxy`;
const DEFAULT_MODEL = MODELS[0].id;
const THREAD_STORAGE_KEY = "tag_threads_v1";
const ACTIVE_THREAD_KEY = "tag_active_thread_v1";
const EDIT_MAX_LENGTH = 12000;
const ANON_SESSION_KEY = "tag_anon_session_v1";
const TAG_ACTIVE_WORKSPACE_KEY = "tag_active_workspace_v1";
const TEMPERATURE_KEY = "tag_temperature_v1";
const MODEL_PRESETS_KEY = "tag_model_presets_v1";
const DRY_RUN_KEY = "tag_dry_run";
const PROMPT_TEMPLATES_KEY = "tag_prompt_templates_v1";

// Tools that require user confirmation before the agent executes them
const ACTIONS_REQUIRING_CONFIRM = new Set([
  "gmail_send",
  "slack_post_message",
  "github_create_issue",
  "linear_create_issue",
  "notion_create_page",
  "calendar_create_event",
]);

// Cost tracking: input $/1M tokens, output $/1M tokens (0 = free/synthetic)
// output-only estimate; input tokens not tracked
const MODEL_COSTS: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4":           { in: 3,    out: 15  },
  "claude-sonnet-4-5":         { in: 3,    out: 15  },
  "hf:openai/gpt-oss-120b":    { in: 0,    out: 0   },
  "hf:deepseek/deepseek-v3.1": { in: 0,    out: 0   },
  "hf:moonshotai/Kimi-K2.6":   { in: 0.95, out: 4.0 },
  "hf:zai-org/GLM-5.1":        { in: 1.0,  out: 3.0 },
  "hf:MiniMaxAI/MiniMax-M2.5": { in: 0.4,  out: 2.0 },
  "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4": { in: 0.3, out: 1.0 },
};

// Context window sizes per model (in tokens)
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "hf:openai/gpt-oss-120b":    128000,
  "claude-sonnet-4":            200000,
  "claude-sonnet-4-5":          200000,
  "hf:deepseek/deepseek-v3.1":  128000,
  "hf:moonshotai/Kimi-K2.6":    256000,
  "hf:zai-org/GLM-5.1":         202000,
  "hf:zai-org/GLM-4.7-Flash":   131072,
  "hf:MiniMaxAI/MiniMax-M2.5":  40960,
  "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4": 262000,
};
const DEFAULT_CONTEXT_WINDOW = 32000;

function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}

function estimateCost(content: string, modelId: string): number {
  const rates = MODEL_COSTS[modelId];
  if (!rates || (rates.in === 0 && rates.out === 0)) return 0;
  // Rough token estimate: chars / 3.3. Treat whole response as output tokens.
  const tokens = content.length / 3.3;
  return (tokens / 1_000_000) * rates.out;
}

function formatCost(cost: number): string {
  if (cost <= 0) return "";
  if (cost < 0.0001) return "<$0.0001";
  return `$${cost.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Model preset types + helpers
// ---------------------------------------------------------------------------

interface Preset {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  temperature: number;
}

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(MODEL_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is Preset =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as Record<string, unknown>).id === "string" &&
        typeof (e as Record<string, unknown>).name === "string" &&
        typeof (e as Record<string, unknown>).model === "string" &&
        typeof (e as Record<string, unknown>).systemPrompt === "string" &&
        typeof (e as Record<string, unknown>).temperature === "number",
    );
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(MODEL_PRESETS_KEY, JSON.stringify(presets));
  } catch {}
}

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  { id: "t1", name: "3-bullet summary",        content: "Summarize this in 3 bullet points." },
  { id: "t2", name: "Translate to Spanish",     content: "Translate to Spanish: {{selection}}" },
  { id: "t3", name: "Explain like I'm 5",       content: "Explain like I'm 5 years old: {{selection}}" },
  { id: "t4", name: "Security code review",     content: "Code review the following for security issues:\n\n{{selection}}" },
  { id: "t5", name: "Extract action items",     content: "Extract all action items from the following text as a numbered list:\n\n{{selection}}" },
];

function loadTemplates(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(PROMPT_TEMPLATES_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TEMPLATES;
    return parsed.filter(
      (e: unknown): e is PromptTemplate =>
        typeof e === "object" && e !== null &&
        typeof (e as Record<string, unknown>).id === "string" &&
        typeof (e as Record<string, unknown>).name === "string" &&
        typeof (e as Record<string, unknown>).content === "string",
    );
  } catch { return DEFAULT_TEMPLATES; }
}

function saveTemplates(templates: PromptTemplate[]): void {
  try { localStorage.setItem(PROMPT_TEMPLATES_KEY, JSON.stringify(templates)); } catch {}
}

function applyTemplate(content: string, selection: string): string {
  if (content.includes("{{selection}}")) return content.replace(/\{\{selection\}\}/g, selection || "");
  if (content.includes("{{}}")) return content.replace(/\{\{\}\}/g, selection || "");
  return content;
}

// ---------------------------------------------------------------------------
// Auto-title helper — first 6 words, title-cased, stripped of punctuation
// ---------------------------------------------------------------------------

function autoTitleFromMessage(text: string): string {
  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 0) return "";
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// Thread management types + helpers
// ---------------------------------------------------------------------------

interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  messages: Message[];
  workspace_id?: string | null;
  pinned?: boolean;
  systemPrompt?: string;
  messageCosts?: Record<string, number>;
  pinnedMessageIds?: string[];
  tags?: string[];
  preSummaryMessages?: Message[];
  preSummaryMeta?: { messageCount: number; hadImages: boolean; hadCode: boolean };
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
    const serialized = JSON.stringify(threads);
    // Size guard: if payload > 4MB, strip preSummaryMessages from all threads
    // to prevent quota exhaustion and silent state corruption.
    if (serialized.length > 4 * 1024 * 1024) {
      console.warn("saveThreads: payload exceeds 4MB, stripping preSummaryMessages to fit.");
      const stripped = threads.map((t) =>
        t.preSummaryMessages ? { ...t, preSummaryMessages: undefined, preSummaryMeta: undefined } : t
      );
      localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(stripped));
    } else {
      localStorage.setItem(THREAD_STORAGE_KEY, serialized);
    }
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

type DateBucket = "Pinned" | "Today" | "Yesterday" | "Earlier this week" | "Earlier this month" | "Older";

function getDateBucket(thread: Thread): DateBucket {
  if (thread.pinned) return "Pinned";
  const ts = thread.updatedAt ?? thread.createdAt;
  const diff = Date.now() - ts;
  const days = diff / 86_400_000;
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return "Earlier this week";
  if (days < 30) return "Earlier this month";
  return "Older";
}

const BUCKET_ORDER: DateBucket[] = ["Pinned", "Today", "Yesterday", "Earlier this week", "Earlier this month", "Older"];

function groupThreadsByBucket(threads: Thread[]): Array<{ bucket: DateBucket; threads: Thread[] }> {
  const map = new Map<DateBucket, Thread[]>();
  for (const t of threads) {
    const b = getDateBucket(t);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(t);
  }
  return BUCKET_ORDER
    .filter((b) => map.has(b))
    .map((b) => ({ bucket: b, threads: map.get(b)! }));
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

async function searchMemories(query: string, jwt: string, workspaceId?: string | null): Promise<Mem0Memory[]> {
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
      body: JSON.stringify({
        query,
        limit: 5,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
      }),
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

function writeMemory(content: string, jwt: string, workspaceId?: string | null): void {
  fetch(`${SUPABASE_URL}/functions/v1/mem0-write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      content,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// EmptyState — rich welcome with templates, tips, model info
// ---------------------------------------------------------------------------

const STARTER_PROMPTS = [
  "Explain quantum computing",
  "Debug this JavaScript error",
  "Plan a weekend in Chicago",
  "Compare React vs Vue",
  "Write a haiku about shipping",
  "Summarize a topic for me",
];

const PRO_TIPS = [
  "⌘K — focus the composer from anywhere",
  "⌘⇧O — open a new thread instantly",
  "⌘⇧F — search across all conversations",
  "/templates — insert a saved prompt snippet",
  "Click any user message to edit and branch",
];

// ---------------------------------------------------------------------------
// Slash commands
// ---------------------------------------------------------------------------

interface SlashCommand {
  trigger: string;
  description: string;
  text: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { trigger: "/summarize",   description: "Summarize in 5 bullets",         text: "Summarize this conversation in 5 bullet points." },
  { trigger: "/tldr",        description: "2-sentence TL;DR",                text: "Give me a 2-sentence TL;DR of the conversation so far." },
  { trigger: "/translate",   description: "Translate last reply",            text: "Translate the previous assistant reply to " },
  { trigger: "/code-review", description: "Code review latest snippet",      text: "Code review the latest code block I shared. Focus on bugs, security, and clarity." },
  { trigger: "/explain",     description: "Explain like I'm 16",             text: "Explain the previous assistant reply like I am a smart 16-year-old." },
];

// Integration icons for the empty state row
const INTEGRATION_ICONS: Array<{ slug: string; label: string; icon: string }> = [
  { slug: "gmail",          label: "Gmail",    icon: "📧" },
  { slug: "slack",          label: "Slack",    icon: "💬" },
  { slug: "github",         label: "GitHub",   icon: "🐙" },
  { slug: "linear",         label: "Linear",   icon: "📋" },
  { slug: "notion",         label: "Notion",   icon: "📝" },
  { slug: "googlecalendar", label: "Calendar", icon: "📅" },
];

interface EmptyStateProps {
  onPickPrompt: (prompt: string) => void;
  templates: PromptTemplate[];
  model: string;
  temperature: number;
  jwt: string | null;
  onOpenSettings: () => void;
}

function EmptyState({ onPickPrompt, templates, model, temperature, jwt, onOpenSettings }: EmptyStateProps) {
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % PRO_TIPS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const topTemplates = templates.slice(0, 3);
  const modelName = MODELS.find((m) => m.id === model)?.name ?? model;

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 px-4 select-none">
      {/* Heading */}
      <h2
        className="text-2xl font-semibold text-foreground text-center"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        What can I help with?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground text-center">
        Free: 10 messages/day anonymous · 50/day signed in.
      </p>

      {/* Template suggestion buttons */}
      <div className="mt-8 flex flex-col gap-2.5 w-full max-w-md">
        {topTemplates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onPickPrompt(tpl.content.replace(/\{\{selection\}\}|\{\{\}\}/g, ""))}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground hover:bg-muted hover:border-primary/30 transition-colors group"
          >
            <span className="flex-1 leading-snug">{tpl.name}</span>
            <span className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors text-xs">→</span>
          </button>
        ))}
      </div>

      {/* Integrations row — only for signed-in users */}
      {jwt && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50">Integrations</p>
          <div className="flex items-center gap-2">
            {INTEGRATION_ICONS.map(({ slug, label, icon }) => (
              <div key={slug} className="relative group">
                <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card text-base hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-default">
                  {icon}
                </div>
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground/90 px-1.5 py-0.5 text-[10px] text-background opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model + temperature info */}
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{modelName}</span>
        <span className="text-muted-foreground/30">·</span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="hover:text-foreground transition-colors"
          title="Open settings"
        >
          temp {temperature.toFixed(1)}
        </button>
      </div>

      {/* Cycling pro tip */}
      <p className="mt-4 text-[11px] text-muted-foreground/60 text-center transition-opacity">
        <span className="font-medium text-muted-foreground/80">Pro tip:</span>{" "}
        {PRO_TIPS[tipIndex]}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CopyButton — one-click copy with checkmark feedback
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      title="Copy message"
      aria-label="Copy message"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
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
  onTogglePin: () => void;
  onUpdateTags?: (tags: string[]) => void;
  // drag-to-reorder (pinned section only)
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

function ThreadRow({ thread, active, onSelect, onDelete, onTogglePin, onUpdateTags, draggable: isDraggable, onDragStart, onDragOver, onDragLeave, onDragEnd, onDrop, isDragOver }: ThreadRowProps) {
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

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

  function commitTags() {
    if (!onUpdateTags) return;
    const existing = thread.tags ?? [];
    const newTags = tagDraft
      .split(",")
      .map((t) => t.trim().toLowerCase().slice(0, 40))
      .filter((t) => t.length > 0);
    const merged = Array.from(new Set([...existing, ...newTags])).slice(0, 10);
    onUpdateTags(merged);
    setTagDraft("");
    setTagInputOpen(false);
  }

  return (
    <li
      className={cn("group relative", isDragOver && "border-t-2 border-primary")}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full text-left rounded-md px-3 py-2.5 transition-colors",
          "border-b border-border/40 last:border-b-0",
          active
            ? "bg-primary/8 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          isDraggable && "cursor-grab active:cursor-grabbing",
          isDragOver && "opacity-60"
        )}
      >
        {/* Active indicator stripe */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r bg-primary" />
        )}
        <p
          className={cn(
            "line-clamp-1 text-xs leading-snug pr-10",
            active ? "font-medium text-foreground" : "font-normal"
          )}
        >
          {thread.pinned && <Pin className="inline h-2.5 w-2.5 mr-1 text-primary/70" />}
          {title}
        </p>
        {/* Tag pills */}
        {thread.tags && thread.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {thread.tags.map((tag) => (
              <span
                key={tag}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-medium text-primary/70"
              >
                {tag}
                {onUpdateTags && (
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={(e) => { e.stopPropagation(); onUpdateTags((thread.tags ?? []).filter((t) => t !== tag)); }}
                    className="text-primary/40 hover:text-destructive transition-colors leading-none"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">
          {relativeTime(thread.updatedAt ?? thread.createdAt)}
        </p>
      </button>

      {/* Tag input inline */}
      {tagInputOpen && (
        <div className="px-3 pb-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitTags(); }
              if (e.key === "Escape") { setTagInputOpen(false); setTagDraft(""); }
            }}
            onBlur={() => { if (tagDraft.trim()) commitTags(); else setTagInputOpen(false); }}
            placeholder="tag1, tag2…"
            className="w-full rounded border border-border bg-background px-2 py-0.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
          />
        </div>
      )}

      {/* Hover actions: tag + pin + delete */}
      <div className="absolute right-1.5 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onUpdateTags && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setTagInputOpen((o) => !o); }}
            aria-label="Add tag"
            className="rounded p-0.5 text-muted-foreground/50 hover:text-primary transition-colors text-[10px] font-mono leading-none"
            title="Add tag"
          >
            #
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          aria-label={thread.pinned ? "Unpin conversation" : "Pin conversation"}
          className="rounded p-0.5 text-muted-foreground/50 hover:text-primary transition-colors"
        >
          {thread.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete conversation"
          className="rounded p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
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

  // ── Online status indicator ─────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastReqOk, setLastReqOk] = useState(true);
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Auto-save indicator ─────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  function saveThreadsWithIndicator(threads: Thread[]): void {
    setSaveState("saving");
    saveThreads(threads);
    // Clear all pending save timers before scheduling new ones
    saveTimersRef.current.forEach((id) => clearTimeout(id));
    saveTimersRef.current.clear();
    // Short pulse — resolve to "saved" after 300ms, then back to idle after 2s
    const t1 = setTimeout(() => {
      setSaveState("saved");
      const t2 = setTimeout(() => {
        setSaveState("idle");
        saveTimersRef.current.delete(t2);
      }, 2000);
      saveTimersRef.current.add(t2);
      saveTimersRef.current.delete(t1);
    }, 300);
    saveTimersRef.current.add(t1);
  }
  // Cleanup all pending save timers on unmount
  useEffect(() => () => {
    saveTimersRef.current.forEach((id) => clearTimeout(id));
    saveTimersRef.current.clear();
  }, []);

  // ── Settings overflow popover ─────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [settingsOpen]);
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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const [input, setInput] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "copied">("idle");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  // Usage display for signed-in users
  const [todayMsgCount, setTodayMsgCount] = useState<number | null>(null);
  const dailyMsgLimit = 50;

  // ── Workspace state ─────────────────────────────────────────────────────
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    // ?ws=<uuid> query param takes priority (set by InviteAccept after joining)
    try {
      const wsParam = new URLSearchParams(window.location.search).get("ws");
      if (wsParam) return wsParam;
      return localStorage.getItem(TAG_ACTIVE_WORKSPACE_KEY) ?? null;
    } catch { return null; }
  });
  const [inviteDialogWorkspaceId, setInviteDialogWorkspaceId] = useState<string | null>(null);
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
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
  useEffect(() => { pendingImagesRef.current = pendingImages; }, [pendingImages]);
  useEffect(() => { activeWorkspaceIdRef.current = activeWorkspaceId; }, [activeWorkspaceId]);

  // ── Temperature — persisted to localStorage, mirrored to ref for fetch closure ──
  const [temperature, setTemperature] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem(TEMPERATURE_KEY) ?? "");
      return isNaN(v) ? 0.7 : Math.min(1.5, Math.max(0, v));
    } catch { return 0.7; }
  });
  // Edit-message state: { msgId, text }
  const [editingMessage, setEditingMessage] = useState<{ msgId: string; text: string } | null>(null);
  // Esc dirty-check: first Esc on dirty textarea arms a "confirm discard" state
  const [editConfirmDiscard, setEditConfirmDiscard] = useState(false);
  // Pinned panel collapsed state
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const temperatureRef = useRef(temperature);
  useEffect(() => { temperatureRef.current = temperature; }, [temperature]);
  useEffect(() => {
    try { localStorage.setItem(TEMPERATURE_KEY, String(temperature)); } catch {}
  }, [temperature]);

  // ── Feature: Dry-run mode ───────────────────────────────────────────────
  const [dryRun, setDryRun] = useState<boolean>(() => {
    try { return localStorage.getItem(DRY_RUN_KEY) === "true"; } catch { return false; }
  });
  const dryRunRef = useRef(dryRun);
  useEffect(() => {
    dryRunRef.current = dryRun;
    try { localStorage.setItem(DRY_RUN_KEY, String(dryRun)); } catch {}
  }, [dryRun]);

  // requireConfirm and pendingConfirm removed — they had no server-enforced effect
  // on the chat path (synthetic-public-proxy is a pure text passthrough, no tool
  // dispatch). Both are only meaningful on the AgentView path (tag-agent-tool).

  // ── Feature: Prompt templates ──────────────────────────────────────────
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => loadTemplates());
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateEditOpen, setTemplateEditOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<PromptTemplate>({ id: "", name: "", content: "" });
  const templatesRef = useRef<HTMLDivElement>(null);

  // ── Model presets ───────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  // ── Smart notifications ──────────────────────────────────────────────────
  const [notifUnseenCount, setNotifUnseenCount] = useState(0);
  const [notifDenied, setNotifDenied] = useState(false);
  const originalTitleRef = useRef("");

  // FIX 6: capture actual document.title on mount before any mutation
  useEffect(() => {
    originalTitleRef.current = document.title;
  }, []);

  // FIX 7: sync sidebar open state with viewport width breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset unseen counter + restore title when the tab regains focus
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        setNotifUnseenCount(0);
        document.title = originalTitleRef.current;
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // ── Sidebar / thread state — declared BEFORE any effect that references them ──
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768; // md: breakpoint — hidden by default on mobile
  });
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_THREAD_KEY); } catch { return null; }
  });
  const [threadSearch, setThreadSearch] = useState("");
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [tagMatchAll, setTagMatchAll] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Global cross-thread search ───────────────────────────────────────────
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchDebounced, setGlobalSearchDebounced] = useState("");
  const globalSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setGlobalSearchDebounced(globalSearchQuery), 200);
    return () => clearTimeout(t);
  }, [globalSearchQuery]);
  useEffect(() => {
    if (globalSearchOpen) setTimeout(() => globalSearchInputRef.current?.focus(), 50);
    else { setGlobalSearchQuery(""); setGlobalSearchDebounced(""); }
  }, [globalSearchOpen]);

  // ── Message cost tracking — costs live in Thread.messageCosts, not separate state ──

  // ── Drag-to-reorder pinned threads ───────────────────────────────────────
  const dragThreadIdRef = useRef<string | null>(null);
  const [dragOverThreadId, setDragOverThreadId] = useState<string | null>(null);

  // Mirror active thread to ref so fetch wrapper closure can read systemPrompt
  const activeThreadRef = useRef<Thread | null>(null);
  useEffect(() => {
    activeThreadRef.current = threads.find((t) => t.id === activeThreadId) ?? null;
  }, [threads, activeThreadId]);

  // Persist active workspace to localStorage; clear ?ws= param after reading it
  useEffect(() => {
    try {
      if (activeWorkspaceId) {
        localStorage.setItem(TAG_ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
      } else {
        localStorage.removeItem(TAG_ACTIVE_WORKSPACE_KEY);
      }
    } catch {}
    // Clear ?ws= from URL once consumed
    const url = new URL(window.location.href);
    if (url.searchParams.has("ws")) {
      url.searchParams.delete("ws");
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeWorkspaceId]);
  const [showProWelcome, setShowProWelcome] = useState(() => {
    try {
      if (localStorage.getItem(PRO_WELCOMED_KEY)) return false;
      return new URLSearchParams(window.location.search).get("pro") === "success";
    } catch {
      return false;
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastWrittenMemoryRef = useRef<string>("");
  const chatStatusRef = useRef<string>("");
  const chatSetMessagesRef = useRef<((msgs: unknown[]) => void) | null>(null);

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

  // Usage display — query chat_usage for today's row, refresh every 30s + after send
  useEffect(() => {
    if (!userId) { setTodayMsgCount(null); return; }
    let cancelled = false;
    async function fetchUsage() {
      const today = new Date().toISOString().slice(0, 10);
      try {
        // TODO: remove `as any` once Supabase types regenerated
        const { data } = await (supabase as any)
          .from("chat_usage")
          .select("msg_count")
          .eq("user_id", userId)
          .eq("day", today)
          .maybeSingle();
        if (!cancelled) setTodayMsgCount(data?.msg_count ?? 0);
      } catch {
        if (!cancelled) setTodayMsgCount(0);
      }
    }
    fetchUsage();
    const interval = setInterval(fetchUsage, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userId]);

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
      const livePendingImages = pendingImagesRef.current;
      const liveWorkspaceId = activeWorkspaceIdRef.current;
      const liveActiveThread = activeThreadRef.current;
      const liveTemperature = temperatureRef.current;
      const liveDryRun = dryRunRef.current;
      // requireConfirm is not read here — see comment below on why confirm/dry-run
      // have no server-enforced effect on the chat path.
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
      // synthetic.new (OpenAI-compatible) requires { role, content: string | array }.
      // Normalize: flatten parts[*].text into content, or pass through if the
      // message is already in legacy { role, content } shape.
      // deno-lint-ignore no-explicit-any
      const rawMessages: Array<any> = reqBody.messages ?? [];
      // deno-lint-ignore no-explicit-any
      const messages: Array<{ role: string; content: any }> = rawMessages.map((m) => {
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
      }).filter((m) => typeof m.content === "string" ? m.content.length > 0 : true);
      const latestUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const latestUserContent: string = typeof latestUserMsg?.content === "string"
        ? latestUserMsg.content
        : "";

      // ── Multi-modal: attach pending images to the latest user message ────────
      // Transform the last user message from { content: "text" } to
      // { content: [{ type:"text", text:"..." }, { type:"image_url", image_url:{url:"data:..."} }, ...] }
      // Only Pro users can attach images (gate enforced in UI + here as a safety net).
      if (livePendingImages.length > 0 && latestUserMsg) {
        // Guard: reject if total base64 payload exceeds 8 MB
        const totalBase64 = livePendingImages.reduce((sum, img) => sum + img.dataUrl.length, 0);
        if (totalBase64 > 8 * 1024 * 1024) {
          throw new Error("Total image size exceeds 8 MB. Remove some images and try again.");
        }
        const textPart = { type: "text", text: latestUserContent };
        const imageParts = livePendingImages.map((img) => ({
          type: "image_url",
          image_url: { url: img.dataUrl },
        }));
        latestUserMsg.content = [textPart, ...imageParts];
        // Clear pending images — they're now baked into the outgoing message.
        setPendingImages([]);
        pendingImagesRef.current = [];
      }

      let finalMessages = messages;

      // ── Per-thread system prompt injection ────────────────────────────────
      if (liveActiveThread?.systemPrompt?.trim()) {
        const alreadyHasThreadSP = finalMessages.some(
          (m) => m.role === "system" && m.content === liveActiveThread.systemPrompt!.trim()
        );
        if (!alreadyHasThreadSP) {
          finalMessages = [{ role: "system", content: liveActiveThread.systemPrompt.trim() }, ...finalMessages];
        }
      }

      if (livePendingFileNote) {
        const fileNoteMsg = {
          role: "system",
          content: `[File just uploaded] ${livePendingFileNote} The file's content has been stored in your memory and is available for retrieval.`,
        };
        finalMessages = [fileNoteMsg, ...finalMessages];
        setPendingFileNote(null);
      }

      // ── Dry-run mode injection ────────────────────────────────────────────
      if (liveDryRun) {
        const dryRunMsg = {
          role: "system",
          content:
            "[Override] DRY RUN MODE: For this turn, describe in detail what tools you would call and with what arguments, but do not actually call any. Output your plan as a numbered list prefixed with 🔍.",
        };
        const alreadyDryRun = finalMessages.some(
          (m) => m.role === "system" && m.content.includes("DRY RUN MODE"),
        );
        if (!alreadyDryRun) {
          finalMessages = [dryRunMsg, ...finalMessages];
        }
      }

      // NOTE: Composio tools are NOT exposed via the Chat surface (useChat →
      // synthetic-public-proxy). They are only available via AgentView (Pro).
      // The [ACTION_PLAN:] prompt-injection sentinel was removed — it was a
      // prompt-injection vector and had no server enforcement anyway.
      // If/when Composio tools are added here, enforce dry_run + confirmation
      // via the same server-side flow as AgentView (tag-agent-tool pending_approval).

      // ── Image generation path ─────────────────────────────────────────────
      // Early-return BEFORE memory lookup — image generation doesn't use memory
      // context and waiting up to 3.5s for it before starting generation is wasteful.
      const selectedModelMeta = MODELS.find((m) => m.id === liveModel);
      if (selectedModelMeta?.modality === "image") {
        const imagePrompt = latestUserContent;
        const imgRes = await fetch(IMAGE_PROXY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(liveJwt ? { Authorization: `Bearer ${liveJwt}` } : {}),
          },
          body: JSON.stringify({ model: liveModel, prompt: imagePrompt }),
        });

        if (!imgRes.ok) {
          let errMsg = "Image generation failed";
          try {
            const errData = await imgRes.json();
            errMsg = errData?.error ?? errMsg;
          } catch {}
          throw new Error(errMsg);
        }

        const imgData = await imgRes.json();
        const imageUrl: string = imgData.image_url ?? "";

        // Embed image data directly into the sentinel so it survives reload.
        // The render loop parses the JSON payload — no in-memory map needed.
        const sentinel = `__IMAGE_RESULT__:${JSON.stringify({ image_url: imageUrl, prompt: imagePrompt, model: liveModel })}`;
        const textId = `text-${Date.now()}`;
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const send = (obj: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            send({ type: "start", messageId });
            send({ type: "start-step" });
            send({ type: "text-start", id: textId });
            send({ type: "text-delta", id: textId, delta: sentinel });
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
      }

      if (liveJwt && latestUserContent) {
        // Hard 3.5s ceiling on memory injection — even if the in-function
        // abort doesn't kick in (e.g. network stack swallows signal), this
        // Promise.race guarantees we move on. Memory is best-effort decoration,
        // never a gate.
        const memories: Mem0Memory[] = await Promise.race([
          searchMemories(latestUserContent, liveJwt, liveWorkspaceId),
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

      // Read Composio BYOK key at request time (same pattern as other live refs)
      const liveComposioKey = readComposioKey() || undefined;

      let response: Response;

      if (activeBYOKProvider && activeBYOKKey && DIRECT_BYOK_PROVIDERS[activeBYOKProvider]) {
        const directUrl = DIRECT_BYOK_PROVIDERS[activeBYOKProvider];
        response = await fetch(directUrl, {
          method: "POST",
          signal: init?.signal,
          headers: {
            "Authorization": `Bearer ${activeBYOKKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: liveModel,
            messages: finalMessages,
            temperature: liveTemperature,
            max_tokens: reqBody.max_tokens ?? 4096,
            stream: true,
          }),
        });
      } else if (activeBYOKProvider && activeBYOKKey) {
        response = await fetch(input as RequestInfo, {
          ...init,
          body: JSON.stringify({
            ...reqBody,
            messages: finalMessages,
            model: liveModel,
            temperature: liveTemperature,
            byok_provider: activeBYOKProvider,
            ...(liveComposioKey ? { byok_composio_key: liveComposioKey } : {}),
          }),
        });
      } else {
        response = await fetch(input as RequestInfo, {
          ...init,
          body: JSON.stringify({
            ...reqBody,
            messages: finalMessages,
            model: liveModel,
            temperature: liveTemperature,
            ...(liveComposioKey ? { byok_composio_key: liveComposioKey } : {}),
          }),
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
              body: JSON.stringify({ ...reqBody, messages: finalMessages, model: liveModel, temperature: liveTemperature }),
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

      // AI SDK v6 UI Message Stream protocol — SSE with typed JSON events.
      // We pipe the upstream OpenAI-compatible SSE (data: {...choices[0].delta.content...})
      // through a transform that emits AI SDK v6 events in real time, so the
      // user sees first words within ~500ms rather than waiting for the full response.
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const textId = `text-${Date.now()}`;

      const upstreamBody = response.body;

      // reader and silenceTimer live in closure scope so the cancel() method
      // can reach them when the consumer abandons the stream.
      let _reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let _silenceTimer: ReturnType<typeof setTimeout> | null = null;

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (obj: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

          send({ type: "start", messageId });
          send({ type: "start-step" });
          send({ type: "text-start", id: textId });

          // 10-second silence timeout — if the upstream stops sending bytes
          // entirely, abort so the UI doesn't hang indefinitely.
          const SILENCE_TIMEOUT_MS = 10_000;

          if (!upstreamBody) {
            // Upstream returned no body — emit empty response cleanly.
            send({ type: "text-end", id: textId });
            send({ type: "finish-step" });
            send({ type: "finish" });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const reader = upstreamBody.getReader();
          _reader = reader;
          const decoder = new TextDecoder();
          let sseBuffer = "";
          let streamErrored = false;
          // reasoning_content accumulator — emitted as a markdown blockquote
          // prefix once regular content starts, so the user sees thinking live.
          let reasoningBuffer = "";
          let reasoningEmitted = false;
          let contentStarted = false;

          const resetSilenceTimer = () => {
            if (_silenceTimer !== null) clearTimeout(_silenceTimer);
            _silenceTimer = setTimeout(() => {
              streamErrored = true;
              reader.cancel("upstream silence timeout").catch(() => {});
              try {
                send({ type: "text-end", id: textId });
                send({ type: "finish-step" });
                send({ type: "finish" });
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              } catch {
                // controller already released — consumer abandoned the stream
              }
            }, SILENCE_TIMEOUT_MS);
          };

          resetSilenceTimer();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done || streamErrored) break;

              resetSilenceTimer();
              sseBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

              // Split on SSE event boundaries (\n\n). Keep the last incomplete chunk.
              const events = sseBuffer.split("\n\n");
              sseBuffer = events.pop() ?? "";

              for (const event of events) {
                for (const line of event.split("\n")) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const raw = trimmed.slice(5).trim();
                  if (raw === "[DONE]") break;
                  try {
                    const parsed = JSON.parse(raw);
                    const choice = parsed?.choices?.[0];
                    // OpenAI-compatible streaming: choices[0].delta.content
                    // Fallback: choices[0].message.content (some providers)
                    const delta: string =
                      choice?.delta?.content ??
                      choice?.message?.content ??
                      "";
                    // reasoning_content: chain-of-thought emitted by reasoning
                    // models (gpt-oss-120b, Kimi-K2.6, etc.) before final answer.
                    // Stream it live as a markdown blockquote so users see thinking happen.
                    const reasoningDelta: string =
                      choice?.delta?.reasoning_content ?? "";

                    if (reasoningDelta) {
                      // Normalize newlines so each new line stays inside the blockquote.
                      const normalized = reasoningDelta.replace(/\r\n/g, "\n").replace(/\n/g, "\n> ");
                      let prefix: string;
                      if (reasoningBuffer.length === 0) {
                        // Very first reasoning chunk: open blockquote.
                        prefix = "> 🧠 *thinking…*\n> ";
                      } else if (contentStarted) {
                        // Reasoning resumed after content — open a fresh blockquote block.
                        prefix = "\n\n> 🧠 *thinking…*\n> ";
                      } else {
                        prefix = "";
                      }
                      reasoningBuffer += reasoningDelta;
                      send({ type: "text-delta", id: textId, delta: prefix + normalized });
                    }
                    if (delta) {
                      // First content chunk after reasoning: inject the blockquote
                      // separator so reasoning and answer are visually distinct.
                      if (!contentStarted && reasoningBuffer && !reasoningEmitted) {
                        reasoningEmitted = true;
                        send({ type: "text-delta", id: textId, delta: "\n\n" });
                      }
                      contentStarted = true;
                      send({ type: "text-delta", id: textId, delta });
                    }
                  } catch {
                    // Malformed JSON chunk — skip silently.
                  }
                }
              }
            }
          } catch {
            // reader.cancel() from silence timeout triggers a read error — handled above.
          } finally {
            if (_silenceTimer !== null) clearTimeout(_silenceTimer);
          }

          // Flush any residual partial event left in the buffer after the loop ends.
          if (!streamErrored && sseBuffer.trim()) {
            for (const line of sseBuffer.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const raw = trimmed.slice(5).trim();
              if (raw === "[DONE]") break;
              try {
                const parsed = JSON.parse(raw);
                const choice = parsed?.choices?.[0];
                const reasoningDelta: string = choice?.delta?.reasoning_content ?? "";
                if (reasoningDelta) {
                  const normalized = reasoningDelta.replace(/\r\n/g, "\n").replace(/\n/g, "\n> ");
                  let prefix: string;
                  if (reasoningBuffer.length === 0) {
                    prefix = "> 🧠 *thinking…*\n> ";
                  } else if (contentStarted) {
                    prefix = "";
                  } else {
                    prefix = "";
                  }
                  reasoningBuffer += reasoningDelta;
                  send({ type: "text-delta", id: textId, delta: prefix + normalized });
                }
                const delta: string = choice?.delta?.content ?? choice?.message?.content ?? "";
                if (delta) {
                  if (!contentStarted && reasoningBuffer && !reasoningEmitted) {
                    reasoningEmitted = true;
                    send({ type: "text-delta", id: textId, delta: "\n\n" });
                  }
                  contentStarted = true;
                  send({ type: "text-delta", id: textId, delta });
                }
              } catch {
                // malformed — skip
              }
            }
          }

          if (!streamErrored) {
            send({ type: "text-end", id: textId });
            send({ type: "finish-step" });
            send({ type: "finish" });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }

          // Write memory after stream fully completes (best-effort, non-blocking).
          if (liveJwt && latestUserContent && latestUserContent.length >= 20 && latestUserContent !== lastWrittenMemoryRef.current) {
            lastWrittenMemoryRef.current = latestUserContent;
            writeMemory(latestUserContent, liveJwt, liveWorkspaceId);
          }
        },
        cancel(reason) {
          if (_silenceTimer !== null) clearTimeout(_silenceTimer);
          _reader?.cancel(reason).catch(() => {});
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

  // Fire notification when streaming finishes while tab is hidden
  const prevStatusForNotifRef = useRef(chat.status ?? "ready");
  useEffect(() => {
    const wasStreaming =
      prevStatusForNotifRef.current === "streaming" ||
      prevStatusForNotifRef.current === "submitted";
    prevStatusForNotifRef.current = chat.status;
    if (!wasStreaming || chat.status !== "ready") return;
    if (!document.hidden) return;

    setNotifUnseenCount((n) => {
      const next = n + 1;
      document.title = `(${next}) ${originalTitleRef.current}`;
      return next;
    });

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant");
      const body = lastAssistant?.parts
        ? lastAssistant.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("").slice(0, 60)
        : "";
      const modelLabel = MODELS.find((m) => m.id === modelRef.current)?.name ?? modelRef.current;
      try {
        new Notification(`Tag — ${modelLabel}`, {
          body: body || "New reply",
          icon: "/logos/tag-graffiti.png",
        });
      } catch {
        // Notification API unavailable in this context — ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.status]);

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
        t.id === activeThreadId ? { ...t, messages: chat.messages, updatedAt: Date.now() } : t
      );
      saveThreadsWithIndicator(updated);
      return updated;
    });
  }, [chat.messages, activeThreadId]);

  // ── Sync chat refs so keydown handler can read latest without re-binding ──
  useEffect(() => {
    chatStatusRef.current = chat.status;
    chatSetMessagesRef.current = chat.setMessages;
  });

  // ── Trust enforcement gap — documented ───────────────────────────────────
  // The Chat surface (useChat → synthetic-public-proxy) is a pure text passthrough.
  // synthetic-public-proxy forwards messages[] to synthetic.new and streams back
  // OpenAI-compat SSE. No tools are defined, no tool_calls are dispatched, and
  // dry_run / confirmed flags are never sent to tag-agent-tool from this path.
  //
  // Consequence: dry-run mode here is soft-only (a system-message hint to the
  // model). The confirmation modal and requireConfirm state have been removed
  // because they could never be triggered on this path.
  //
  // When Composio tools are eventually wired into the Chat surface, enforce
  // dry_run + confirmation server-side via the same tag-agent-tool pending_approval
  // flow as AgentView (see AgentView.tsx callTool → tag-integrations approve/dismiss).

  // ── Compute cost when streaming finishes ─────────────────────────────────
  const prevStatusRef = useRef(chat.status);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    prevStatusRef.current = chat.status;
    if (!wasStreaming || (chat.status !== "ready" && chat.status !== "error")) return;
    // Find the last assistant message and compute its cost
    const lastAssistant = [...chat.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    const content = lastAssistant.parts
      ? lastAssistant.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
      : (lastAssistant as unknown as { content?: string }).content ?? "";
    const cost = estimateCost(content, modelRef.current);
    if (cost <= 0) return;
    // Write cost directly into the active thread — no stale closure, short-circuit if already set
    setThreads((prev) => {
      if (!activeThreadId) return prev;
      const thread = prev.find((t) => t.id === activeThreadId);
      if (!thread) return prev;
      if (thread.messageCosts?.[lastAssistant.id] !== undefined) return prev; // already computed
      const updated = prev.map((t) =>
        t.id === activeThreadId
          ? { ...t, messageCosts: { ...(t.messageCosts ?? {}), [lastAssistant.id]: cost } }
          : t
      );
      saveThreadsWithIndicator(updated);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.status]);

  // ── Auto-title: generate title from first user message after streaming ends ──
  const autoTitledThreadsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (chat.status !== "ready" && chat.status !== "error") return;
    if (!activeThreadId) return;
    // Skip if already auto-titled this session
    if (autoTitledThreadsRef.current.has(activeThreadId)) return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    // Only auto-title threads with default/empty titles
    if (thread.title && thread.title !== "New chat") return;
    const firstUserMsg = thread.messages.find((m) => m.role === "user");
    if (!firstUserMsg) return;
    const text = firstUserMsg.parts
      ? (firstUserMsg.parts.find((p) => p.type === "text") as { type: "text"; text: string } | undefined)?.text ?? ""
      : (firstUserMsg as unknown as { content?: string }).content ?? "";
    if (!text.trim()) return;
    const generated = autoTitleFromMessage(text.trim());
    if (!generated) return;
    autoTitledThreadsRef.current.add(activeThreadId);
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === activeThreadId && (!t.title || t.title === "New chat")
          ? { ...t, title: generated }
          : t
      );
      saveThreadsWithIndicator(updated);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.status, activeThreadId]);

  // ── Error banner visibility: show on new error AFTER user has actively sent
  // this session. Without the hasSent guard, rehydrated chat.error from old
  // restored threads would show the banner on every page load. Cleared when
  // streaming starts on the next attempt.
  useEffect(() => {
    if (chat.error && hasSentThisSessionRef.current) {
      setShowError(true);
      setLastReqOk(false);
    }
  }, [chat.error]);

  useEffect(() => {
    if (chat.status === "streaming" || chat.status === "submitted") {
      setShowError(false);
    }
    if (chat.status === "ready" && hasSentThisSessionRef.current && !chat.error) {
      setLastReqOk(true);
    }
  }, [chat.status, chat.error]);

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

  // ── Thread helpers — declared BEFORE keyboard effect that depends on createNewThread ──
  const createNewThread = useCallback(() => {
    const newThread: Thread = {
      id: generateId(),
      title: "",
      createdAt: Date.now(),
      messages: [],
      workspace_id: activeWorkspaceIdRef.current,
    };
    setThreads((prev) => {
      const updated = [newThread, ...prev];
      saveThreadsWithIndicator(updated);
      return updated;
    });
    setActiveThreadId(newThread.id);
    try { localStorage.setItem(ACTIVE_THREAD_KEY, newThread.id); } catch {}
    chat.setMessages([]);
    setInput("");
    setMemoryActive(false);
    setPendingImages([]);
    pendingImagesRef.current = [];
  }, [chat]);

  // ── Global keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip during IME composition (Japanese/Chinese/Korean input methods)
      if (e.isComposing) return;

      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const inTextInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      // Esc — close any open drawer/panel/search/slash (on keydown so IME Esc is safe)
      if (e.key === "Escape") {
        setByokOpen(false);
        setAccountDrawerOpen(false);
        setMemoryDrawerOpen(false);
        setSystemPromptOpen(false);
        setThreadSearch("");
        setSlashOpen(false);
        setGlobalSearchOpen(false);
        // Close mobile sidebar if open (only meaningful below md breakpoint)
        if (window.innerWidth < 768) setSidebarOpen(false);
        return;
      }

      if (!mod) return;

      // Cmd/Ctrl+Shift+F — open global cross-thread search
      if (e.key === "f" && e.shiftKey) {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }
      // Cmd/Ctrl+F — focus sidebar thread search (override browser find)
      if (e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // Cmd/Ctrl+K — focus composer (skip if already typing in a text field)
      if (e.key === "k" && !e.shiftKey) {
        if (inTextInput) return;
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }
      // Cmd/Ctrl+Shift+O — new thread
      if (e.key === "o" && e.shiftKey) {
        e.preventDefault();
        createNewThread();
        return;
      }
      // Cmd/Ctrl+/ — open BYOK drawer (skip if typing)
      if (e.key === "/" && !inTextInput) {
        e.preventDefault();
        setByokOpen(true);
        return;
      }
      // Cmd/Ctrl+Shift+Backspace — clear current thread messages
      if (e.key === "Backspace" && e.shiftKey && !inTextInput) {
        if (chatStatusRef.current === "streaming" || chatStatusRef.current === "submitted") return;
        e.preventDefault();
        if (!activeThreadId) return;
        if (!window.confirm("Clear all messages in this thread?")) return;
        chatSetMessagesRef.current?.([]);
        setThreads((prev) => {
          const updated = prev.map((t) =>
            t.id === activeThreadId ? { ...t, messages: [] } : t
          );
          saveThreadsWithIndicator(updated);
          return updated;
        });
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createNewThread, activeThreadId]);

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
      setPendingImages([]);
      pendingImagesRef.current = [];
    },
    [chat]
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => {
        const updated = prev.filter((t) => t.id !== threadId);
        saveThreadsWithIndicator(updated);
        return updated;
      });
      autoTitledThreadsRef.current.delete(threadId);
      if (threadId === activeThreadId) {
        createNewThread();
      }
    },
    [activeThreadId, createNewThread]
  );

  const togglePinThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, pinned: !t.pinned } : t
      );
      saveThreadsWithIndicator(updated);
      return updated;
    });
  }, []);

  const handlePinnedDrop = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setThreads((prev) => {
      const pinned = prev.filter((t) => t.pinned);
      const unpinned = prev.filter((t) => !t.pinned);
      const dragIdx = pinned.findIndex((t) => t.id === draggedId);
      const targetIdx = pinned.findIndex((t) => t.id === targetId);
      if (dragIdx < 0 || targetIdx < 0) return prev;
      const reordered = [...pinned];
      const [dragged] = reordered.splice(dragIdx, 1);
      reordered.splice(targetIdx, 0, dragged);
      const updated = [...reordered, ...unpinned];
      saveThreadsWithIndicator(updated);
      return updated;
    });
  }, []);

  const forkFromMessage = useCallback((messageId: string) => {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    const msgIndex = thread.messages.findIndex((m) => m.id === messageId);
    if (msgIndex < 0) return;
    const sliced = thread.messages.slice(0, msgIndex + 1);
    let forkedMessages: typeof sliced;
    try {
      forkedMessages = structuredClone(sliced);
    } catch {
      forkedMessages = JSON.parse(JSON.stringify(sliced));
    }
    const newThread: Thread = {
      id: generateId(),
      title: (thread.title || "Chat") + " (fork)",
      createdAt: Date.now(),
      messages: forkedMessages,
      workspace_id: thread.workspace_id,
      pinned: false,
      systemPrompt: thread.systemPrompt,
      pinnedMessageIds: (thread.pinnedMessageIds ?? []).filter((id) => forkedMessages.some((m) => m.id === id)),
    };
    setThreads((prev) => {
      const updated = [newThread, ...prev];
      saveThreadsWithIndicator(updated);
      return updated;
    });
    setActiveThreadId(newThread.id);
    try { localStorage.setItem(ACTIVE_THREAD_KEY, newThread.id); } catch {}
    chat.setMessages(forkedMessages);
    setInput("");
    setMemoryActive(false);
    setPendingImages([]);
    pendingImagesRef.current = [];
  }, [threads, activeThreadId, chat]);

  // ── Feature: Regenerate assistant response ──────────────────────────────
  const regenerateFromMessage = useCallback((assistantMsgId: string) => {
    if (chat.status === "streaming" || chat.status === "submitted") return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    const msgIndex = thread.messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex < 0) return;
    // Find the immediately-preceding user message
    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (thread.messages[i].role === "user") { userMsgIndex = i; break; }
    }
    if (userMsgIndex < 0) return; // no preceding user message — no-op
    const userMsg = thread.messages[userMsgIndex];
    const userText = userMsg.parts
      ? userMsg.parts.filter((p: { type?: string }) => p.type === "text").map((p: { text?: string }) => p.text ?? "").join("")
      : (userMsg as unknown as { content?: string }).content ?? "";
    if (!userText.trim()) return;
    // Fork into a new thread with " (regen)" suffix — preserves original
    const sliced = thread.messages.slice(0, userMsgIndex + 1);
    let base: typeof sliced;
    try { base = structuredClone(sliced); } catch { base = JSON.parse(JSON.stringify(sliced)); }
    const newThread: Thread = {
      id: generateId(),
      title: (thread.title || "Chat") + " (regen)",
      createdAt: Date.now(),
      messages: base,
      workspace_id: thread.workspace_id,
      pinned: false,
      systemPrompt: thread.systemPrompt,
      pinnedMessageIds: (thread.pinnedMessageIds ?? []).filter((id) => base.some((m) => m.id === id)),
    };
    setThreads((prev) => {
      const updated = [newThread, ...prev];
      saveThreadsWithIndicator(updated);
      return updated;
    });
    setActiveThreadId(newThread.id);
    try { localStorage.setItem(ACTIVE_THREAD_KEY, newThread.id); } catch {}
    chat.setMessages(base);
    setInput("");
    setMemoryActive(false);
    setPendingImages([]);
    pendingImagesRef.current = [];
    hasSentThisSessionRef.current = true;
    chat.sendMessage({ text: userText });
  }, [threads, activeThreadId, chat]);

  // ── Feature: Edit user message + branch ─────────────────────────────────
  const commitEditMessage = useCallback((msgId: string, newText: string) => {
    if (chat.status === "streaming" || chat.status === "submitted") return;
    if (newText.length > EDIT_MAX_LENGTH) return; // caller shows inline error
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    const msgIndex = thread.messages.findIndex((m) => m.id === msgId);
    if (msgIndex < 0) return;
    const sliced = thread.messages.slice(0, msgIndex);
    let base: typeof sliced;
    try { base = structuredClone(sliced); } catch { base = JSON.parse(JSON.stringify(sliced)); }
    const newThread: Thread = {
      id: generateId(),
      title: (thread.title || "Chat") + " (edit)",
      createdAt: Date.now(),
      messages: base,
      workspace_id: thread.workspace_id,
      pinned: false,
      systemPrompt: thread.systemPrompt,
      pinnedMessageIds: (thread.pinnedMessageIds ?? []).filter((id) => base.some((m) => m.id === id)),
    };
    setThreads((prev) => {
      const updated = [newThread, ...prev];
      saveThreadsWithIndicator(updated);
      return updated;
    });
    setActiveThreadId(newThread.id);
    try { localStorage.setItem(ACTIVE_THREAD_KEY, newThread.id); } catch {}
    chat.setMessages(base);
    setInput("");
    setMemoryActive(false);
    setPendingImages([]);
    pendingImagesRef.current = [];
    setEditingMessage(null);
    hasSentThisSessionRef.current = true;
    chat.sendMessage({ text: newText });
  }, [threads, activeThreadId, chat]);

  // ── Feature: Pin/unpin individual messages ───────────────────────────────
  const togglePinMessage = useCallback((msgId: string) => {
    setThreads((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        const ids = t.pinnedMessageIds ?? [];
        const newIds = ids.includes(msgId) ? ids.filter((id) => id !== msgId) : [...ids, msgId];
        return { ...t, pinnedMessageIds: newIds };
      });
      saveThreadsWithIndicator(updated);
      return updated;
    });
  }, [activeThreadId]);

  const saveSystemPrompt = useCallback((threadId: string, prompt: string) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, systemPrompt: prompt } : t
      );
      saveThreadsWithIndicator(updated);
      return updated;
    });
  }, []);

  // ── Feature: Thread tags ─────────────────────────────────────────────────
  const updateThreadTags = useCallback((threadId: string, tags: string[]) => {
    setThreads((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, tags } : t
      );
      saveThreadsWithIndicator(updated);
      return updated;
    });
  }, []);

  // ── Feature: Auto-summarize long thread ─────────────────────────────────
  const handleSummarize = useCallback(async () => {
    if (!activeThreadId || !jwt) return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread || thread.messages.length < 5) return;
    if (chat.status === "streaming" || chat.status === "submitted") return;
    setSummarizing(true);

    // Keep the most recent 20 messages intact; summarize everything before
    const KEEP_RECENT = 20;
    const msgs = thread.messages;
    const cutoff = Math.max(0, msgs.length - KEEP_RECENT);
    const toSummarize = msgs.slice(0, cutoff);
    const toKeep = msgs.slice(cutoff);

    if (toSummarize.length === 0) { setSummarizing(false); return; }

    // Build a condensed transcript for the summary request
    const transcript = toSummarize
      .filter((m) => m.role !== "system")
      .map((m) => {
        const body = m.parts
          ? m.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
          : (m as unknown as { content?: string }).content ?? "";
        return `${m.role === "user" ? "User" : "Assistant"}: ${body.slice(0, 500)}`;
      })
      .join("\n\n");

    const systemMsg = "Summarize the conversation so far into 5-8 key bullet points capturing: decisions made, code/data references, open questions, action items. Output as markdown.";

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/synthetic-public-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "user", content: `${systemMsg}\n\nTranscript:\n${transcript}` },
          ],
          stream: false,
        }),
      });

      let summaryText = "";
      if (res.ok) {
        const data = await res.json().catch(() => null);
        summaryText = data?.choices?.[0]?.message?.content
          ?? data?.content?.[0]?.text
          ?? "";
      }
      if (!summaryText) summaryText = `Summarized ${toSummarize.length} earlier messages.`;

      // Build a synthetic summary message
      const summaryId = generateId();
      const summaryMessage: Message = {
        id: summaryId,
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: `**Earlier conversation summary (${toSummarize.length} messages)**\n\n${summaryText}` }],
      };

      const newMessages = [summaryMessage, ...toKeep];

      // Compute surviving messageCosts and pinnedMessageIds
      const keepIds = new Set(toKeep.map((m) => m.id));
      const oldCosts = thread.messageCosts ?? {};
      const newCosts: Record<string, number> = {};
      for (const [k, v] of Object.entries(oldCosts)) {
        if (keepIds.has(k)) newCosts[k] = v;
      }
      const newPinnedIds = (thread.pinnedMessageIds ?? []).filter((id) => keepIds.has(id));

      // Build lossy snapshot: text-only excerpt, no image parts, max 1000 chars.
      const toSummaryLossy: Message[] = toSummarize.map((m) => {
        const textOnly = (m.parts ?? [])
          .filter((p) => p.type === "text")
          .map((p) => ("text" in p ? (p as { type: "text"; text: string }).text : ""))
          .join("")
          .slice(0, 1000);
        return { id: m.id, role: m.role, parts: [{ type: "text" as const, text: textOnly }] };
      });
      const hadImages = toSummarize.some((m) =>
        (m.parts ?? []).some((p) => p.type === "image" || p.type === "file")
      );
      const hadCode = toSummarize.some((m) =>
        (m.parts ?? []).some((p) => p.type === "text" && "text" in p && /```/.test((p as { type: "text"; text: string }).text))
      );

      // Race defense: re-read current messages; append any sent-during-fetch messages.
      setThreads((prev) => {
        const currentThread = prev.find((t) => t.id === activeThreadId);
        const currentMsgs = currentThread?.messages ?? newMessages;
        // If new messages arrived after our cutoff, append them after the summary.
        const lateSent = currentMsgs.slice(msgs.length);
        const finalMessages = lateSent.length > 0 ? [...newMessages, ...lateSent] : newMessages;

        const updated = prev.map((t) => {
          if (t.id !== activeThreadId) return t;
          return {
            ...t,
            messages: finalMessages,
            messageCosts: newCosts,
            pinnedMessageIds: newPinnedIds,
            // Chain with existing snapshot so re-summarize keeps full history.
            preSummaryMessages: [...(t.preSummaryMessages ?? []), ...toSummaryLossy],
            preSummaryMeta: {
              messageCount: (t.preSummaryMessages?.length ?? 0) + toSummarize.length,
              hadImages: (t.preSummaryMeta?.hadImages ?? false) || hadImages,
              hadCode: (t.preSummaryMeta?.hadCode ?? false) || hadCode,
            },
          };
        });
        saveThreadsWithIndicator(updated);
        // Sync chat messages with any late-sent additions.
        if (lateSent.length > 0) chat.setMessages(finalMessages);
        return updated;
      });
      chat.setMessages(newMessages);
    } catch {
      // silent fail
    } finally {
      setSummarizing(false);
    }
  }, [activeThreadId, jwt, threads, chat, model]);

  const handleUndoSummarize = useCallback(() => {
    if (!activeThreadId) return;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread?.preSummaryMessages) return;
    const restored = [...thread.preSummaryMessages, ...thread.messages.slice(1)]; // remove the summary message
    setThreads((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== activeThreadId) return t;
        return { ...t, messages: restored, preSummaryMessages: undefined };
      });
      saveThreadsWithIndicator(updated);
      return updated;
    });
    chat.setMessages(restored);
  }, [activeThreadId, threads, chat]);

  function handleExportThread() {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    const modelName = MODELS.find((m) => m.id === model)?.name ?? model;
    const title = thread.title || "Untitled conversation";
    const date = new Date().toISOString().slice(0, 10);
    const lines: string[] = [
      `# ${title}`,
      ``,
      `*Exported from Tag — hecz.dev/chat — ${date}*`,
      ``,
    ];
    for (const msg of thread.messages) {
      if (msg.role === "system") continue;
      const content = msg.parts
        ? msg.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
        : (msg as unknown as { content?: string }).content ?? "";
      if (!content) continue;
      lines.push(msg.role === "user" ? `## You` : `## Tag (${modelName})`);
      lines.push(``);
      lines.push(content);
      lines.push(``);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    // FIX 4: "tag-" prefix for defense in depth. Browser <a download> strips path
    // separators today, but this would be fragile if the logic ever moves server-side.
    const slug = "tag-" + (title.replace(/[^a-z0-9-]+/gi, "-").slice(0, 40).replace(/-+$/, "") || `thread-${thread.id.slice(0, 8)}`);
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread) return;
    const title = thread.title || "Untitled conversation";
    const date = new Date().toISOString().slice(0, 10);
    const payload = {
      title,
      model,
      systemPrompt: thread.systemPrompt ?? "",
      temperature,
      messageCosts: thread.messageCosts ?? {},
      messages: thread.messages,
      exportedAt: new Date().toISOString(),
      exportedFrom: "tag — hecz.dev/chat",
    };
    // FIX 5: Guard against circular references in payload (e.g. if message parts ever
    // contain self-referential objects). Primary: standard stringify. Fallback: WeakSet
    // cycle detector that substitutes "[Circular]" for any repeated object reference.
    let jsonStr: string;
    try {
      jsonStr = JSON.stringify(payload, null, 2);
    } catch {
      try {
        const seen = new WeakSet();
        jsonStr = JSON.stringify(payload, (_key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          return value;
        }, 2);
      } catch (err) {
        setImportError(`Export failed: ${err instanceof Error ? err.message : "unknown error"}`);
        setTimeout(() => setImportError(null), 8000);
        return;
      }
    }
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    // FIX 4: "tag-" prefix for defense in depth. Browser <a download> strips path
    // separators today, but this would be fragile if the logic ever moves server-side.
    const slug = "tag-" + (title.replace(/[^a-z0-9-]+/gi, "-").slice(0, 40).replace(/-+$/, "") || `thread-${thread.id.slice(0, 8)}`);
    a.href = url;
    a.download = `${slug}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON(file: File) {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result;
        if (typeof raw !== "string") throw new Error("Could not read file.");
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid JSON structure.");
        if (!Array.isArray(parsed.messages)) throw new Error("Missing required field: messages (array).");
        if (typeof parsed.title !== "string") throw new Error("Missing required field: title (string).");

        // FIX 1: Per-message validation — allowlist roles to ["user","assistant"] only.
        // "system" role is intentionally excluded: a malicious import with system-role
        // messages could override system prompts when the thread is resumed, enabling
        // prompt-injection via crafted JSON files.
        const ALLOWED_ROLES = new Set(["user", "assistant"]);
        const validatedMessages = parsed.messages.map((m: unknown, i: number) => {
          if (typeof m !== "object" || m === null) throw new Error(`Message at index ${i} is not an object.`);
          const msg = m as Record<string, unknown>;
          // Role must be in allowlist
          if (!ALLOWED_ROLES.has(msg.role as string)) {
            throw new Error(`Message at index ${i} has disallowed role "${msg.role}". Only "user" and "assistant" are permitted.`);
          }
          // content (string) OR parts (array) must be present
          const hasContent = typeof msg.content === "string";
          const hasParts = Array.isArray(msg.parts);
          if (!hasContent && !hasParts) {
            throw new Error(`Message at index ${i} must have a "content" string or "parts" array.`);
          }
          // Auto-generate id if missing or non-string
          const id: string = typeof msg.id === "string" ? msg.id : generateId();
          // Strip unknown top-level keys — keep only known safe fields
          const clean: Record<string, unknown> = { id, role: msg.role };
          if (hasContent) clean.content = msg.content;
          if (hasParts) clean.parts = msg.parts;
          return clean;
        });

        // Validate messageCosts shape if present
        const messageCosts: Record<string, number> = {};
        if (parsed.messageCosts && typeof parsed.messageCosts === "object") {
          for (const [k, v] of Object.entries(parsed.messageCosts)) {
            if (typeof v === "number") messageCosts[k] = v;
          }
        }
        const newThread: Thread = {
          id: generateId(),
          title: parsed.title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: validatedMessages as Message[],
          systemPrompt: typeof parsed.systemPrompt === "string" ? parsed.systemPrompt : undefined,
          messageCosts: Object.keys(messageCosts).length > 0 ? messageCosts : undefined,
        };
        // FIX 2: Validate imported model string against MODELS registry.
        // Reject unknown model IDs silently (keep current model) rather than
        // applying an arbitrary string that could confuse the backend or UI.
        const knownModelIds = new Set(MODELS.map((m) => m.id));
        if (typeof parsed.model === "string" && parsed.model && knownModelIds.has(parsed.model)) {
          setModel(parsed.model);
        }
        if (typeof parsed.temperature === "number") {
          setTemperature(Math.min(1.5, Math.max(0, parsed.temperature)));
        }
        const updated = [newThread, ...threads];
        setThreads(updated);
        saveThreadsWithIndicator(updated);
        setActiveThreadId(newThread.id);
        try { localStorage.setItem(ACTIVE_THREAD_KEY, newThread.id); } catch {}
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Failed to import file.");
        setTimeout(() => setImportError(null), 8000);
      }
    };
    reader.readAsText(file);
  }

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

  function handleImageAttached(img: PendingImage) {
    if (!img.dataUrl.startsWith("data:image/")) return;
    setPendingImages((prev) => {
      if (prev.length >= 4) {
        setPendingFileNote("Max 4 images per message. Remove one before adding more.");
        return prev;
      }
      const next = [...prev, img];
      pendingImagesRef.current = next;
      return next;
    });
  }

  function removePendingImage(idx: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleShare() {
    if (!jwt) return; // gate: signed-in only
    if (shareStatus === "sharing") return;
    const activeThread = threads.find((t) => t.id === activeThreadId);
    if (!activeThread || activeThread.messages.length === 0) return;

    const confirmed = window.confirm(
      "This will create a public link anyone can view.\n\nThe full conversation including every message will be visible to anyone with the link.\n\nContinue?"
    );
    if (!confirmed) return;

    setShareStatus("sharing");
    try {
      // TODO: remove `as any` once types regenerated after migration
      const { data: token, error } = await (supabase as any).rpc("create_shared_thread", {
        p_title: activeThread.title || "Untitled",
        p_messages: activeThread.messages,
        p_model: model,
      });
      if (error) throw error;
      const url = `${window.location.origin}/chat/share/${token as string}`;
      setShareToken(token as string);
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 4000);
    } catch {
      setShareStatus("idle");
    }
  }

  function handleSavePreset() {
    const name = window.prompt("Preset name:");
    if (!name?.trim()) return;
    const activeThread = threads.find((t) => t.id === activeThreadId);
    const newPreset: Preset = {
      id: generateId(),
      name: name.trim(),
      model,
      systemPrompt: activeThread?.systemPrompt ?? "",
      temperature,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    setPresetsOpen(false);
  }

  function handleApplyPreset(preset: Preset) {
    setModel(preset.model);
    setTemperature(preset.temperature);
    if (activeThreadId && preset.systemPrompt !== undefined) {
      saveSystemPrompt(activeThreadId, preset.systemPrompt);
    }
    setPresetsOpen(false);
  }

  function handleDeletePreset(presetId: string) {
    const updated = presets.filter((p) => p.id !== presetId);
    setPresets(updated);
    savePresets(updated);
  }

  // Close presets popover on outside click
  useEffect(() => {
    if (!presetsOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setPresetsOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [presetsOpen]);


  // Close templates popover on outside click
  useEffect(() => {
    if (!templatesOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setTemplatesOpen(false);
        setTemplateEditOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [templatesOpen]);

  // Persist templates changes
  useEffect(() => { saveTemplates(templates); }, [templates]);


  const isEmpty = chat.messages.length === 0;
  // Derived active thread for cost lookup and other render-time reads
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  // ── Context window utilization ────────────────────────────────────────────
  const contextStats = useMemo(() => {
    const thread = threads.find((t) => t.id === activeThreadId);
    if (!thread || thread.messages.length === 0) return null;
    // FIX 3: Image token estimate — each image part is ~800 tokens (Vision API rough average
    // for a 512×512 tile; actual cost varies by resolution but 800 is a safe conservative floor).
    const IMAGE_TOKEN_COST = 800;
    let imageTokens = 0;
    const msgChars = thread.messages.reduce((sum, msg) => {
      // Count image tokens from parts array
      if (msg.parts) {
        for (const p of msg.parts) {
          if ((p as { type?: string }).type === "image" || (p as { type?: string }).type === "image_url") {
            imageTokens += IMAGE_TOKEN_COST;
          }
        }
      }
      // Count image tokens from content array (multi-modal message format)
      const contentArr = (msg as unknown as { content?: unknown }).content;
      if (Array.isArray(contentArr)) {
        for (const part of contentArr) {
          if (typeof part === "object" && part !== null) {
            const t = (part as { type?: string }).type;
            if (t === "image" || t === "image_url") imageTokens += IMAGE_TOKEN_COST;
          }
        }
      }
      const body = msg.parts
        ? msg.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
        : typeof contentArr === "string" ? contentArr : "";
      return sum + body.length;
    }, 0);
    const sysPromptChars = (thread.systemPrompt ?? "").length;
    const SYS_OVERHEAD = 300; // rough tokens for system framing
    const msgTokens = Math.round(msgChars / 3.3) + imageTokens;
    const sysTokens = Math.round(sysPromptChars / 3.3) + SYS_OVERHEAD;
    const totalTokens = msgTokens + sysTokens;
    const windowSize = getContextWindow(model);
    const pct = totalTokens / windowSize;
    return { msgTokens, sysTokens, totalTokens, windowSize, pct };
  }, [threads, activeThreadId, model]);

  // ── Memoized cross-thread search results ─────────────────────────────────
  type SearchResult = { threadId: string; threadTitle: string; messageId: string; snippet: string; matchStart: number };
  const globalSearchResults = useMemo<SearchResult[]>(() => {
    const q = globalSearchDebounced.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: SearchResult[] = [];
    for (const thread of threads) {
      for (const msg of thread.messages) {
        if (msg.role === "system") continue;
        const body = msg.parts
          ? msg.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
          : (msg as unknown as { content?: string }).content ?? "";
        const idx = body.toLowerCase().indexOf(q);
        if (idx < 0) continue;
        const start = Math.max(0, idx - 30);
        const end = Math.min(body.length, idx + q.length + 30);
        const snippet = (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
        results.push({ threadId: thread.id, threadTitle: thread.title || "Untitled", messageId: msg.id, snippet, matchStart: idx - start + (start > 0 ? 1 : 0) });
        if (results.length >= 40) break;
      }
      if (results.length >= 40) break;
    }
    return results;
  }, [globalSearchDebounced, threads]);

  // ── Starter prompt pick — sets input and focuses textarea; does not send ──
  function handlePickPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  // Anon now allowed unconditionally (IP rate limit + Cloudflare DDoS in front
  // of Supabase replaces the per-message Turnstile gate).
  const hasContent = input.trim().length > 0 || pendingImages.length > 0;
  // Vision with images requires Pro — block send and show inline prompt instead.
  const visionBlockedByTier = pendingImages.length > 0 && tier !== "pro";
  const canSend =
    chat.status !== "streaming" &&
    chat.status !== "submitted" &&
    !summarizing &&
    hasContent &&
    !visionBlockedByTier;

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
            "flex flex-col bg-card border-r border-border transition-all duration-200 shrink-0 overflow-hidden",
            sidebarOpen
              ? "w-56 md:w-64"
              : "w-0 overflow-hidden",
            "fixed inset-y-0 left-0 z-40 md:relative md:z-auto"
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

            {/* Workspace switcher — sidebar instance (sign-in only).
                Top-bar pill instance lives in the main header above. */}
            {jwt && (
              <WorkspaceSwitcher
                jwt={jwt}
                activeWorkspaceId={activeWorkspaceId}
                onChange={(id) => {
                  setActiveWorkspaceId(id);
                  createNewThread();
                }}
              />
            )}

            {/* Threads label + search */}
            <div className="px-3 pt-3 pb-1.5 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Conversations
              </span>
              {/* Search box — Cmd+F focuses this */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search conversations"
                  className="w-full rounded-md border border-border/50 bg-background pl-6 pr-6 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors"
                />
                {threadSearch && (
                  <button
                    type="button"
                    onClick={() => setThreadSearch("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Thread list — filtered to active workspace, grouped by date bucket (flat when searching) */}
            <nav className="flex-1 overflow-y-auto px-1.5 pb-4">
              {(() => {
                const workspaceThreads = threads
                  .filter((t) => (t.workspace_id ?? null) === activeWorkspaceId)
                  .sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
                  });

                // Collect all distinct tags for the filter chip row
                const allTags = Array.from(
                  new Set(workspaceThreads.flatMap((t) => t.tags ?? []))
                ).sort();

                const q = threadSearch.trim().toLowerCase();

                // Apply tag filter on top of workspace filter (OR by default, AND when tagMatchAll)
                const tagFiltered = activeTagFilters.length > 0
                  ? workspaceThreads.filter((t) =>
                      tagMatchAll
                        ? activeTagFilters.every((tag) => (t.tags ?? []).includes(tag))
                        : activeTagFilters.some((tag) => (t.tags ?? []).includes(tag))
                    )
                  : workspaceThreads;

                // Single shared tag filter chip row — rendered once above all branches
                const tagChips = allTags.length > 0 ? (
                  <div className="px-2 pt-2 pb-1 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setActiveTagFilters((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          )}
                          className={cn(
                            "rounded-full px-2 py-0 text-[9px] font-medium border transition-colors",
                            activeTagFilters.includes(tag)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          #{tag}
                        </button>
                      ))}
                      {activeTagFilters.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTagFilters([])}
                          className="text-[9px] text-muted-foreground/50 hover:text-foreground transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {activeTagFilters.length > 1 && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={tagMatchAll}
                          onChange={(e) => setTagMatchAll(e.target.checked)}
                          className="h-3 w-3 accent-primary"
                        />
                        <span className="text-[9px] text-muted-foreground/60">Match all</span>
                      </label>
                    )}
                  </div>
                ) : null;

                // When searching: flat list filtered by title or any message body
                if (q) {
                  const matched = tagFiltered.filter((t) => {
                    if (t.title.toLowerCase().includes(q)) return true;
                    return t.messages.some((m) => {
                      const body = m.parts
                        ? m.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
                        : (m as unknown as { content?: string }).content ?? "";
                      return body.toLowerCase().includes(q);
                    });
                  });
                  return (
                    <>
                      {tagChips}
                      <p className="px-2 pt-2 pb-1 font-mono text-[10px] text-muted-foreground/50">
                        {matched.length} of {workspaceThreads.length} threads
                      </p>
                      {matched.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground/50">No matches.</p>
                      ) : (
                        <ul>
                          {matched.map((thread) => (
                            <ThreadRow
                              key={thread.id}
                              thread={thread}
                              active={thread.id === activeThreadId}
                              onSelect={() => selectThread(thread)}
                              onDelete={() => deleteThread(thread.id)}
                              onTogglePin={() => togglePinThread(thread.id)}
                              onUpdateTags={(tags) => updateThreadTags(thread.id, tags)}
                            />
                          ))}
                        </ul>
                      )}
                    </>
                  );
                }

                // Normal: date bucket grouping
                if (tagFiltered.length === 0) {
                  return (
                    <>
                      {tagChips}
                      <p className="px-2 py-3 text-xs text-muted-foreground/50">
                        {activeTagFilters.length > 0 ? "No threads match selected tags." : "No conversations yet."}
                      </p>
                    </>
                  );
                }
                const groups = groupThreadsByBucket(tagFiltered);
                return (
                  <>
                    {tagChips}
                    {groups.map(({ bucket, threads: bucketThreads }) => (
                      <div key={bucket}>
                        <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 px-2 pt-3 pb-1">
                          {bucket}
                        </p>
                        <ul>
                          {bucketThreads.map((thread) => (
                            <ThreadRow
                              key={thread.id}
                              thread={thread}
                              active={thread.id === activeThreadId}
                              onSelect={() => selectThread(thread)}
                              onDelete={() => deleteThread(thread.id)}
                              onTogglePin={() => togglePinThread(thread.id)}
                              onUpdateTags={(tags) => updateThreadTags(thread.id, tags)}
                              draggable={bucket === "Pinned"}
                              isDragOver={bucket === "Pinned" && dragOverThreadId === thread.id}
                              onDragStart={bucket === "Pinned" ? (e) => {
                                dragThreadIdRef.current = thread.id;
                                e.dataTransfer.effectAllowed = "move";
                              } : undefined}
                              onDragOver={bucket === "Pinned" ? (e) => {
                                e.preventDefault();
                                setDragOverThreadId(thread.id);
                              } : undefined}
                              onDragLeave={bucket === "Pinned" ? (e) => {
                                // Only clear if leaving the li itself, not a child element
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                  setDragOverThreadId(null);
                                }
                              } : undefined}
                              onDragEnd={bucket === "Pinned" ? () => {
                                dragThreadIdRef.current = null;
                                setDragOverThreadId(null);
                              } : undefined}
                              onDrop={bucket === "Pinned" ? (e) => {
                                e.preventDefault();
                                const dragged = dragThreadIdRef.current;
                                dragThreadIdRef.current = null;
                                setDragOverThreadId(null);
                                if (dragged) handlePinnedDrop(dragged, thread.id);
                              } : undefined}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </>
                );
              })()}
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

              {/* Notification permission request — only shown when permission is "default" */}
              {typeof Notification !== "undefined" && Notification.permission === "default" && (
                <button
                  type="button"
                  onClick={() => {
                    Notification.requestPermission().then((result) => {
                      if (result === "denied") setNotifDenied(true);
                    }).catch(() => {});
                  }}
                  className="w-full text-left text-[10px] text-muted-foreground/60 hover:text-primary transition-colors px-2 py-0.5"
                >
                  Enable notifications
                </button>
              )}
              {/* FIX 5: inline denied feedback — no toast */}
              {notifDenied && (
                <p className="text-[10px] text-destructive/80 px-2 py-0.5 leading-snug">
                  Notifications denied — enable in browser settings to receive them.
                  <button
                    type="button"
                    onClick={() => setNotifDenied(false)}
                    className="ml-1.5 underline hover:no-underline"
                  >
                    Dismiss
                  </button>
                </p>
              )}

              {/* Integrations panel — per-user Composio OAuth connections */}
              <IntegrationsPanel jwt={jwt} />

              {/* Scheduled prompts — save prompt + cron schedule for automatic runs */}
              {jwt && <ScheduledPromptsPanel jwt={jwt} />}

              {/* Usage dashboard — token/cost stats per model */}
              {jwt && <UsageDashboard jwt={jwt} />}

              {/* Agent activity log — collapsible tool call history */}
              <AgentActivityLog jwt={jwt} />

              {/* hecz.dev mini-nav — small, unobtrusive, cross-surface links */}
              <div className="flex items-center gap-3 px-2 pt-1 text-[10px] text-muted-foreground/60">
                <a href="/" className="hover:text-foreground transition-colors">hecz.dev</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/learn" className="hover:text-foreground transition-colors">Learn</a>
                <span className="text-muted-foreground/30">·</span>
                <a href="/chat/self-host" className="hover:text-foreground transition-colors">Self-host</a>
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
            className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* ── Main column ────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

          {/* Top bar — t3-style minimal */}
          <header className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card shrink-0">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setSidebarOpen((s) => !s)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="md:hidden rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* View toggle pills */}
            <div className="flex items-center gap-1 shrink-0">
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

            {/* Thread title — inline-editable, centered */}
            {view === "chat" && (() => {
              const activeThread = threads.find((t) => t.id === activeThreadId);
              const titleText = activeThread?.title || "New chat";
              return (
                <input
                  type="text"
                  value={titleText === "New chat" ? "" : titleText}
                  onChange={(e) => {
                    if (!activeThreadId) return;
                    const newTitle = e.target.value;
                    setThreads((prev) => {
                      const updated = prev.map((t) =>
                        t.id === activeThreadId ? { ...t, title: newTitle } : t
                      );
                      saveThreadsWithIndicator(updated);
                      return updated;
                    });
                  }}
                  placeholder="New chat"
                  aria-label="Thread title"
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none text-center truncate px-2"
                />
              );
            })()}
            {view !== "chat" && <div className="flex-1" />}

            {/* Model picker — chat mode only */}
            {view === "chat" && (
              <ModelPicker value={model} onChange={setModel} onUpgrade={handleUpgrade} tier={tier} />
            )}

            {/* Workspace switcher pill — left of NotificationCenter */}
            {/* TODO: filter threads/memories by activeWorkspaceId in subsequent wave */}
            {view === "chat" && (
              <WorkspaceSwitcher
                jwt={jwt}
                activeWorkspaceId={activeWorkspaceId}
                onChange={(id) => {
                  setActiveWorkspaceId(id);
                  createNewThread();
                }}
              />
            )}

            {/* Notification center */}
            {view === "chat" && jwt && (
              <NotificationCenter jwt={jwt} />
            )}

            {/* Settings overflow popover */}
            {view === "chat" && (
              <div className="relative shrink-0" ref={settingsRef}>
                {/* Hidden file input for import */}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportJSON(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  title="Settings"
                  aria-label="Chat settings"
                  className={cn(
                    "inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                    settingsOpen
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                </button>

                {settingsOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden">

                    {/* Templates section */}
                    <div className="px-3 pt-3 pb-1">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">Templates</p>
                      <div className="relative" ref={templatesRef}>
                        <button
                          type="button"
                          onClick={() => { setTemplatesOpen((o) => !o); setTemplateEditOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
                            templatesOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <Layout className="h-3.5 w-3.5 shrink-0" />
                          Prompt templates
                        </button>
                        {templatesOpen && (
                          <div className="mt-1 rounded-lg border border-border bg-card shadow-md overflow-hidden">
                            {!templateEditOpen ? (
                              <>
                                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                                  <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">Templates</span>
                                  <button
                                    type="button"
                                    onClick={() => { setTemplateDraft({ id: "", name: "", content: "" }); setTemplateEditOpen(true); }}
                                    className="text-[11px] text-primary hover:opacity-80 transition-opacity"
                                  >+ New</button>
                                </div>
                                <div className="max-h-44 overflow-y-auto">
                                  {templates.map((t) => (
                                    <div key={t.id} className="group flex items-center gap-1 border-b border-border/30 last:border-b-0">
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const applied = applyTemplate(t.content, input);
                                          setInput(applied);
                                          setTemplatesOpen(false);
                                          setSettingsOpen(false);
                                          setTimeout(() => textareaRef.current?.focus(), 0);
                                        }}
                                        className="flex-1 text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                                      >
                                        <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{t.content.slice(0, 48)}{t.content.length > 48 ? "…" : ""}</p>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setTemplateDraft(t); setTemplateEditOpen(true); }}
                                        className="opacity-0 group-hover:opacity-100 mr-2 text-muted-foreground/60 hover:text-foreground transition-all"
                                        title="Edit template"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="p-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">
                                    {templateDraft.id ? "Edit" : "New"} Template
                                  </span>
                                  <button type="button" onClick={() => setTemplateEditOpen(false)} className="text-muted-foreground/60 hover:text-foreground">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Template name"
                                  value={templateDraft.name}
                                  onChange={(e) => setTemplateDraft((d) => ({ ...d, name: e.target.value }))}
                                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                                />
                                <textarea
                                  placeholder={"Template text… use {{selection}} to insert current input"}
                                  value={templateDraft.content}
                                  onChange={(e) => setTemplateDraft((d) => ({ ...d, content: e.target.value }))}
                                  rows={3}
                                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
                                />
                                <div className="flex gap-1 justify-end">
                                  {templateDraft.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTemplates((ts) => ts.filter((t) => t.id !== templateDraft.id));
                                        setTemplateEditOpen(false);
                                      }}
                                      className="rounded px-2 py-1 text-[11px] text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >Delete</button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={!templateDraft.name.trim() || !templateDraft.content.trim()}
                                    onClick={() => {
                                      if (!templateDraft.name.trim() || !templateDraft.content.trim()) return;
                                      if (templateDraft.id) {
                                        setTemplates((ts) => ts.map((t) => t.id === templateDraft.id ? templateDraft : t));
                                      } else {
                                        setTemplates((ts) => [...ts, { ...templateDraft, id: crypto.randomUUID() }]);
                                      }
                                      setTemplateEditOpen(false);
                                    }}
                                    className="rounded px-2 py-1 text-[11px] bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                                  >Save</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Presets section */}
                    <div className="px-3 pb-1">
                      <div className="relative" ref={presetsRef}>
                        <button
                          type="button"
                          onClick={() => setPresetsOpen((o) => !o)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
                            presetsOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <BookMarked className="h-3.5 w-3.5 shrink-0" />
                          Model presets
                        </button>
                        {presetsOpen && (
                          <div className="mt-1 rounded-lg border border-border bg-card shadow-md overflow-hidden">
                            {presets.length === 0 ? (
                              <p className="px-3 py-2.5 text-xs text-muted-foreground">No presets saved yet.</p>
                            ) : (
                              <ul className="max-h-44 overflow-y-auto">
                                {presets.map((preset) => (
                                  <li key={preset.id} className="group flex items-center gap-1 border-b border-border/40 last:border-b-0">
                                    <button
                                      type="button"
                                      onClick={() => handleApplyPreset(preset)}
                                      className="flex-1 flex flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted transition-colors"
                                    >
                                      <span className="text-xs font-medium text-foreground truncate w-full">{preset.name}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground/60 truncate w-full">{preset.model} · t={preset.temperature.toFixed(1)}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePreset(preset.id)}
                                      aria-label={`Delete preset ${preset.name}`}
                                      className="mr-1.5 rounded p-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-colors"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button
                              type="button"
                              onClick={handleSavePreset}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border-t border-border/40 transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              Save current as preset
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-border/50 mx-3 my-1" />

                    {/* Temperature */}
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Thermometer className="h-3.5 w-3.5" />
                          Temperature
                        </span>
                        <span className="font-mono text-[11px] text-primary/70">{temperature.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">Precise</span>
                        <input
                          type="range"
                          min={0}
                          max={1.5}
                          step={0.1}
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="flex-1 accent-primary h-1"
                          aria-label="Temperature"
                        />
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">Creative</span>
                      </div>
                    </div>

                    <div className="h-px bg-border/50 mx-3 my-1" />

                    {/* Dry-run toggle */}
                    <div className="px-3 py-1">
                      <button
                        type="button"
                        onClick={() => setDryRun((v) => !v)}
                        aria-pressed={dryRun}
                        className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                      >
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {dryRun ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          Dry-run mode
                        </span>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          dryRun ? "bg-amber-100 text-amber-700" : "text-muted-foreground/40"
                        )}>
                          {dryRun ? "ON" : "OFF"}
                        </span>
                      </button>
                    </div>

                    {/* System prompt */}
                    <div className="px-3 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          const t = threads.find((t) => t.id === activeThreadId);
                          setSystemPromptDraft(t?.systemPrompt ?? "");
                          setSystemPromptOpen((o) => !o);
                          setSettingsOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
                          threads.find((t) => t.id === activeThreadId)?.systemPrompt?.trim()
                            ? "text-primary bg-primary/5 hover:bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Terminal className="h-3.5 w-3.5 shrink-0" />
                        System prompt
                        {threads.find((t) => t.id === activeThreadId)?.systemPrompt?.trim() && (
                          <span className="ml-auto text-[9px] text-primary/60 font-mono">set</span>
                        )}
                      </button>
                    </div>

                    <div className="h-px bg-border/50 mx-3 my-1" />

                    {/* Search + Share */}
                    <div className="px-3 py-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => { setGlobalSearchOpen(true); setSettingsOpen(false); }}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                      >
                        <SearchCode className="h-3.5 w-3.5 shrink-0" />
                        Search threads
                        <kbd className="ml-auto font-mono text-[9px] text-muted-foreground/40">⌘⇧F</kbd>
                      </button>
                      {jwt ? (
                        shareStatus === "copied" ? (
                          <a
                            href={`/chat/share/${shareToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5 shrink-0" />
                            Link copied — open →
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { handleShare(); setSettingsOpen(false); }}
                            disabled={shareStatus === "sharing" || chat.messages.length === 0}
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 text-left"
                          >
                            <Share2 className="h-3.5 w-3.5 shrink-0" />
                            {shareStatus === "sharing" ? "Sharing…" : "Share thread"}
                          </button>
                        )
                      ) : null}
                    </div>

                    {/* Context window info */}
                    {contextStats !== null && (
                      <div className="px-3 pb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground/60">Context window</span>
                          <span className={cn(
                            "font-mono text-[10px]",
                            contextStats.pct >= 0.8 ? "text-destructive" : contextStats.pct >= 0.5 ? "text-amber-600" : "text-muted-foreground/60"
                          )}>
                            ~{contextStats.totalTokens >= 1000 ? `${(contextStats.totalTokens / 1000).toFixed(0)}k` : contextStats.totalTokens}
                            {" / "}
                            {contextStats.windowSize >= 1000 ? `${(contextStats.windowSize / 1000).toFixed(0)}k` : contextStats.windowSize}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              contextStats.pct >= 0.8 ? "bg-destructive" : contextStats.pct >= 0.5 ? "bg-amber-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(100, contextStats.pct * 100).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Current model info */}
                    <div className="px-3 pb-2">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 px-2 pb-1">Current model</p>
                      {(() => {
                        const meta = MODELS.find((m) => m.id === model);
                        const ctxTokens = getContextWindow(model);
                        const ctxLabel = ctxTokens >= 1000 ? `${Math.round(ctxTokens / 1000)}k tokens` : `${ctxTokens} tokens`;
                        const costs = MODEL_COSTS[model];
                        const hasCost = costs && (costs.in > 0 || costs.out > 0);
                        const providerLabel = meta?.provider === "byok" ? "BYOK" : "Synthetic";
                        return (
                          <div className="rounded-md bg-muted/40 px-2 py-1.5 space-y-0.5">
                            <p className="text-xs font-medium text-foreground truncate">{meta?.label ?? model}</p>
                            <p className="text-[10px] text-muted-foreground/70">{providerLabel} · {ctxLabel}</p>
                            {hasCost && (
                              <p className="font-mono text-[10px] text-muted-foreground/60">
                                ${costs.in}/1k in · ${costs.out}/1k out
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="h-px bg-border/50 mx-3 my-1" />

                    {/* Export / Import */}
                    <div className="px-3 py-1 space-y-0.5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50 px-2 pb-0.5">Export / Import</p>
                      <button
                        type="button"
                        onClick={() => { handleExportThread(); setSettingsOpen(false); }}
                        disabled={chat.messages.length === 0}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 text-left"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        Export as Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleExportJSON(); setSettingsOpen(false); }}
                        disabled={chat.messages.length === 0}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 text-left"
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        Export as JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => { importInputRef.current?.click(); setSettingsOpen(false); }}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                      >
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                        Import JSON
                      </button>
                    </div>

                    {/* BYOK + Skin + Memory */}
                    <div className="h-px bg-border/50 mx-3 my-1" />
                    <div className="px-3 py-1 pb-2 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => { setByokOpen(true); setSettingsOpen(false); }}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
                      >
                        <Key className="h-3.5 w-3.5 shrink-0" />
                        API keys (BYOK)
                      </button>
                      {jwt && (
                        <button
                          type="button"
                          onClick={() => { setMemoryDrawerOpen((o) => !o); setSettingsOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
                            memoryActive ? "text-primary bg-primary/5 hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <Brain className="h-3.5 w-3.5 shrink-0" />
                          Memory {memoryActive ? "(active)" : ""}
                        </button>
                      )}
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span className="text-xs text-muted-foreground flex-1">Theme skin</span>
                        <SkinPicker skin={skin} onChange={setSkin} />
                      </div>
                      {jwt && tier !== "pro" && (
                        <button
                          type="button"
                          onClick={() => { handleUpgrade(); setSettingsOpen(false); }}
                          disabled={upgrading}
                          className="w-full flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
                        >
                          <Crown className="h-3 w-3 shrink-0" />
                          {upgrading ? "Redirecting…" : "Upgrade to Pro · $7/mo"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-chat views: keep BYOK + skin accessible */}
            {view !== "chat" && (
              <>
                <button
                  type="button"
                  onClick={() => setByokOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Key className="h-3.5 w-3.5" />
                </button>
                <SkinPicker skin={skin} onChange={setSkin} />
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
              </>
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

          {importError && (
            <div
              role="alert"
              className="mx-4 mt-2 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive"
            >
              <span>Import failed: {importError}</span>
              <button
                type="button"
                aria-label="Dismiss import error"
                onClick={() => setImportError(null)}
                className="shrink-0 text-destructive/60 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
                        <EmptyState
                          onPickPrompt={handlePickPrompt}
                          templates={templates}
                          model={model}
                          temperature={temperature}
                          jwt={jwt}
                          onOpenSettings={() => setSettingsOpen((o) => !o)}
                        />
                      ) : (
                        <div className="flex flex-col gap-6">
                          {/* ── Summarize earlier / undo banner ── */}
                          {activeThread?.preSummaryMessages && (
                            <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                              <span>
                                Summarized {activeThread.preSummaryMeta?.messageCount ?? activeThread.preSummaryMessages.length} earlier messages
                                {(activeThread.preSummaryMeta?.hadImages || activeThread.preSummaryMeta?.hadCode) && (
                                  <span className="ml-1 text-[10px] opacity-70">
                                    (text only — images{activeThread.preSummaryMeta?.hadCode ? " and code blocks" : ""} were not preserved in the snapshot)
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={handleUndoSummarize}
                                className="text-primary hover:underline text-[11px] ml-3 shrink-0"
                              >
                                Restore
                              </button>
                            </div>
                          )}
                          {!activeThread?.preSummaryMessages && contextStats !== null && (chat.messages.length > 50 || contextStats.pct >= 0.5) && (
                            <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                              <span>
                                {chat.messages.length > 50
                                  ? `${chat.messages.length} messages in this thread`
                                  : `~${(contextStats.pct * 100).toFixed(0)}% context used`}
                              </span>
                              <button
                                type="button"
                                onClick={handleSummarize}
                                disabled={summarizing || chat.status === "streaming" || chat.status === "submitted" || !jwt}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground hover:bg-muted transition-colors disabled:opacity-40 ml-3 shrink-0"
                              >
                                {summarizing ? "Summarizing…" : "Summarize earlier"}
                              </button>
                            </div>
                          )}
                          {/* ── Pinned messages panel ── */}
                          {activeThread?.pinnedMessageIds && activeThread.pinnedMessageIds.length > 0 && (
                            <div className="rounded-lg border border-border/60 bg-muted/40 text-sm">
                              <button
                                type="button"
                                onClick={() => setPinnedPanelOpen((o) => !o)}
                                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {pinnedPanelOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <Bookmark className="h-3 w-3" />
                                Pinned in this thread ({activeThread.pinnedMessageIds.length})
                              </button>
                              {pinnedPanelOpen && (
                                <div className="flex flex-col divide-y divide-border/40">
                                  {activeThread.pinnedMessageIds.map((pid) => {
                                    const pinned = activeThread.messages.find((m) => m.id === pid);
                                    if (!pinned) return null;
                                    const pinnedContent = pinned.parts
                                      ? pinned.parts.filter((p) => p.type === "text").map((p) => ("text" in p ? p.text : "")).join("")
                                      : (pinned as unknown as { content?: string }).content ?? "";
                                    const snippet = pinnedContent.slice(0, 120) + (pinnedContent.length > 120 ? "…" : "");
                                    return (
                                      <button
                                        key={pid}
                                        type="button"
                                        onClick={() => document.getElementById(`msg-${pid}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                        className="flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                                      >
                                        <span className="shrink-0 mt-0.5 text-[10px] font-medium text-primary/60 uppercase">{pinned.role === "user" ? "you" : "tag"}</span>
                                        <span className="text-xs text-muted-foreground leading-relaxed">{snippet}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {chat.messages.map((msg) => {
                            const content = msg.parts
                              ? msg.parts
                                  .filter((p) => p.type === "text")
                                  .map((p) => ("text" in p ? p.text : ""))
                                  .join("")
                              : msg.content;

                            const isPinnedMsg = activeThread?.pinnedMessageIds?.includes(msg.id) ?? false;

                            if (msg.role === "user") {
                              const isEditing = editingMessage?.msgId === msg.id;
                              return (
                                <div key={msg.id} id={`msg-${msg.id}`} className="flex items-end justify-end gap-2.5">
                                  <div className="flex flex-col items-end gap-1 max-w-[75%]">
                                    {isEditing ? (
                                      <div className="flex flex-col gap-1.5 w-full">
                                        <textarea
                                          autoFocus
                                          className={cn(
                                            "w-full rounded-2xl rounded-br-sm bg-primary/10 border px-4 py-2.5 text-sm text-foreground leading-relaxed resize-none focus:outline-none min-h-[60px]",
                                            editConfirmDiscard
                                              ? "border-amber-500 focus:border-amber-500"
                                              : editingMessage.text.length > EDIT_MAX_LENGTH
                                              ? "border-destructive focus:border-destructive"
                                              : "border-primary/30 focus:border-primary/60"
                                          )}
                                          value={editingMessage.text}
                                          onChange={(e) => { setEditingMessage({ msgId: msg.id, text: e.target.value }); setEditConfirmDiscard(false); }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Escape") {
                                              e.preventDefault();
                                              const isDirty = editingMessage.text !== content;
                                              if (!isDirty || editConfirmDiscard) {
                                                setEditingMessage(null);
                                                setEditConfirmDiscard(false);
                                              } else {
                                                setEditConfirmDiscard(true);
                                                setTimeout(() => setEditConfirmDiscard(false), 3000);
                                              }
                                            }
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEditMessage(msg.id, editingMessage.text); }
                                          }}
                                        />
                                        {editingMessage.text.length > EDIT_MAX_LENGTH && (
                                          <p className="text-[11px] text-destructive px-1">Message too long ({editingMessage.text.length}/{EDIT_MAX_LENGTH} chars) — trim before branching.</p>
                                        )}
                                        {editConfirmDiscard && (
                                          <p className="text-[11px] text-amber-600 px-1">Press Esc again to discard your edit.</p>
                                        )}
                                        <div className="flex gap-1 justify-end">
                                          <button type="button" onClick={() => { setEditingMessage(null); setEditConfirmDiscard(false); }} className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                                          <button
                                            type="button"
                                            onClick={() => commitEditMessage(msg.id, editingMessage.text)}
                                            disabled={editingMessage.text.length > EDIT_MAX_LENGTH}
                                            className="rounded px-2 py-0.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                          >Save &amp; branch</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className={cn(
                                          "rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed whitespace-pre-wrap group relative",
                                          chat.status === "streaming" || chat.status === "submitted"
                                            ? "opacity-70 cursor-default"
                                            : "cursor-pointer"
                                        )}
                                        title={chat.status === "streaming" || chat.status === "submitted" ? "Wait for response to finish" : "Click to edit and branch"}
                                        onClick={() => {
                                          if (chat.status === "streaming" || chat.status === "submitted") return;
                                          setEditingMessage({ msgId: msg.id, text: content });
                                        }}
                                      >
                                        {content}
                                        <Pencil className="absolute top-1.5 right-1.5 h-2.5 w-2.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => togglePinMessage(msg.id)}
                                        title={isPinnedMsg ? "Unpin message" : "Pin message"}
                                        className={cn("inline-flex items-center rounded px-1 py-0.5 text-[10px] transition-colors", isPinnedMsg ? "text-primary/70 hover:text-primary" : "text-muted-foreground/40 hover:text-foreground hover:bg-muted")}
                                      >
                                        {isPinnedMsg ? <BookmarkX className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="h-7 w-7 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary uppercase">
                                    {userId ? userId.slice(0, 1) : "Y"}
                                  </div>
                                </div>
                              );
                            }

                            // Detect image generation sentinel injected by the fetch wrapper.
                            // Format: __IMAGE_RESULT__:<JSON> where JSON has image_url/prompt/model.
                            // Data is embedded in the sentinel (not an in-memory map) so it
                            // survives page reload.
                            let imageResult: { imageUrl: string; prompt: string; model: string } | null = null;
                            if (content.startsWith("__IMAGE_RESULT__:")) {
                              try {
                                const raw = JSON.parse(content.slice("__IMAGE_RESULT__:".length).trim());
                                imageResult = { imageUrl: raw.image_url ?? "", prompt: raw.prompt ?? "", model: raw.model ?? "" };
                              } catch {
                                imageResult = null;
                              }
                            }

                            return (
                              <div key={msg.id} id={`msg-${msg.id}`} className="flex items-start gap-2.5">
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
                                  {imageResult ? (
                                    <ImageBubble
                                      imageUrl={imageResult.imageUrl}
                                      prompt={imageResult.prompt}
                                      model={imageResult.model}
                                    />
                                  ) : (
                                    <Suspense fallback={<span className="text-muted-foreground text-xs">…</span>}>
                                      <MessageContent content={content} />
                                    </Suspense>
                                  )}
                                  {!imageResult && content && (
                                    <div className="mt-1 flex items-center gap-1">
                                      <TTSButton
                                        text={content}
                                        byokKey={byokKeys?.["openai"]}
                                      />
                                      <CopyButton text={content} />
                                      <button
                                        type="button"
                                        onClick={() => forkFromMessage(msg.id)}
                                        title="Fork conversation from here"
                                        aria-label="Fork conversation from here"
                                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                                      >
                                        <GitFork className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => regenerateFromMessage(msg.id)}
                                        disabled={chat.status === "streaming" || chat.status === "submitted"}
                                        title={chat.status === "streaming" || chat.status === "submitted" ? "Wait for response to finish" : "Regenerate response"}
                                        aria-label="Regenerate response"
                                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground/50"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => togglePinMessage(msg.id)}
                                        title={isPinnedMsg ? "Unpin message" : "Pin message"}
                                        aria-label={isPinnedMsg ? "Unpin message" : "Pin message"}
                                        className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] transition-colors", isPinnedMsg ? "text-primary/70 hover:text-primary" : "text-muted-foreground/50 hover:text-foreground hover:bg-muted")}
                                      >
                                        {isPinnedMsg ? <BookmarkX className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                                      </button>
                                      {activeThread?.messageCosts?.[msg.id] != null && activeThread.messageCosts[msg.id] > 0 && (
                                        <span className="font-mono text-[10px] text-muted-foreground/40 ml-1" title="est. output cost only">
                                          {formatCost(activeThread.messageCosts[msg.id])}
                                        </span>
                                      )}
                                    </div>
                                  )}
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

                {/* System prompt panel — slides open above the composer */}
                {systemPromptOpen && (
                  <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-0">
                    <div className="mx-auto max-w-2xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                          System prompt for this thread
                        </span>
                        <button
                          type="button"
                          onClick={() => setSystemPromptOpen(false)}
                          aria-label="Close system prompt editor"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
                        placeholder="You are a helpful assistant specialized in…"
                        rows={3}
                        value={systemPromptDraft}
                        onChange={(e) => setSystemPromptDraft(e.target.value)}
                        onBlur={() => {
                          if (activeThreadId) saveSystemPrompt(activeThreadId, systemPromptDraft);
                        }}
                      />
                      <p className="mt-1 mb-2 text-[10px] text-muted-foreground/50">
                        Injected at the top of every send in this thread. Saved automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sticky composer — t3-style centered card */}
                <div className="shrink-0 bg-background px-4 py-3">
                  {/* Usage indicator — signed-in users only */}
                  {userId && todayMsgCount !== null && (
                    <div className="mx-auto max-w-3xl mb-1.5 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground/50">
                        {todayMsgCount}/{dailyMsgLimit} today
                      </span>
                      {todayMsgCount >= dailyMsgLimit && (
                        <span className="text-[10px] text-destructive/70">· limit reached</span>
                      )}
                    </div>
                  )}

                  {/* Slash command autocomplete */}
                  {slashOpen && (() => {
                    const partial = input.slice(1).toLowerCase();
                    const filtered = SLASH_COMMANDS.filter((c) => c.trigger.slice(1).startsWith(partial));
                    if (filtered.length === 0) return null;
                    return (
                      <div className="mx-auto max-w-3xl mb-1 rounded-lg border border-border bg-card shadow-md overflow-hidden">
                        {filtered.map((cmd, i) => (
                          <button
                            key={cmd.trigger}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setInput(cmd.text);
                              setSlashOpen(false);
                              setTimeout(() => textareaRef.current?.focus(), 0);
                            }}
                            className={cn(
                              "w-full flex items-baseline gap-3 px-3 py-2 text-left transition-colors hover:bg-muted",
                              i !== 0 && "border-t border-border/40"
                            )}
                          >
                            <span className="font-mono text-[11px] text-primary shrink-0">{cmd.trigger}</span>
                            <span className="text-xs text-muted-foreground truncate">{cmd.description}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Composer card */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (slashOpen) {
                        const partial = input.slice(1).toLowerCase();
                        const filtered = SLASH_COMMANDS.filter((c) => c.trigger.slice(1).startsWith(partial));
                        if (filtered.length > 0) {
                          setInput(filtered[0].trigger + " ");
                          setSlashOpen(false);
                          return;
                        }
                        setSlashOpen(false);
                      }
                      if (!input.trim()) return;
                      if (!activeThreadId) createNewThread();
                      hasSentThisSessionRef.current = true;
                      chat.sendMessage({ text: input });
                      setInput("");
                      setSlashOpen(false);
                    }}
                    className="relative mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/40 transition-colors overflow-hidden"
                  >
                    {/* Pending image chips — above textarea, only when present */}
                    {pendingImages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                        {pendingImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={img.dataUrl}
                              alt={img.name}
                              className="h-12 w-12 rounded-lg object-cover border border-border"
                            />
                            <button
                              type="button"
                              onClick={() => removePendingImage(idx)}
                              aria-label={`Remove ${img.name}`}
                              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                        {visionBlockedByTier && (
                          <div className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/8 px-2 py-1 text-xs text-foreground self-center">
                            <Crown className="h-3 w-3 text-primary shrink-0" />
                            <span>Vision is a <button type="button" onClick={handleUpgrade} className="underline underline-offset-2 text-primary hover:opacity-80 transition-opacity">Pro feature</button></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Textarea — no border, card carries it */}
                    <textarea
                      ref={textareaRef}
                      disabled={summarizing}
                      className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 leading-relaxed max-h-40"
                      placeholder={summarizing ? "Summarizing earlier messages…" : MODELS.find((m) => m.id === model)?.modality === "image" ? "Describe an image…" : "Message Tag…"}
                      rows={1}
                      value={input}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInput(val);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                        setSlashOpen(val.startsWith("/") && !val.includes(" "));
                      }}
                      onKeyDown={(e) => {
                        if (slashOpen && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))) {
                          const partial = input.slice(1).toLowerCase();
                          const filtered = SLASH_COMMANDS.filter((c) => c.trigger.slice(1).startsWith(partial));
                          if (filtered.length > 0) {
                            e.preventDefault();
                            setInput(filtered[0].text);
                            setSlashOpen(false);
                            return;
                          }
                        }
                        if (e.key === "Escape" && slashOpen) {
                          e.preventDefault();
                          setSlashOpen(false);
                          return;
                        }
                        if (e.key === "Enter" && !e.shiftKey && !slashOpen) {
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

                    {/* Bottom row — left: paperclip + mic, right: stop/send */}
                    <div className="flex items-center justify-between px-3 pb-2.5">
                      <div className="flex items-center gap-1">
                        <FileDropzone
                          jwt={jwt}
                          tier={tier}
                          onIngested={handleFileIngested}
                          onImageAttached={handleImageAttached}
                        />
                        <MicButton
                          onTranscript={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)}
                          byokKey={byokKeys?.["openai"]}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Offline dot — red only when offline, hidden when connected */}
                        {(!isOnline || !lastReqOk) && (
                          <span
                            title={!isOnline ? "Offline" : "Last request failed"}
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                              !isOnline ? "bg-red-500" : "bg-amber-400"
                            )}
                          />
                        )}
                        {/* Save dot — pulses during save, fades when idle */}
                        {saveState !== "idle" && (
                          <span className="inline-flex items-center">
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full shrink-0 transition-opacity",
                                saveState === "saving" ? "bg-primary animate-pulse" : "bg-primary/30"
                              )}
                              title={saveState === "saving" ? "Saving…" : "Saved"}
                            />
                            <span className="sr-only">{saveState === "saving" ? "Saving..." : "Saved"}</span>
                          </span>
                        )}
                        {(chat.status === "streaming" || chat.status === "submitted") ? (
                          <button
                            type="button"
                            onClick={() => chat.stop()}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/15 transition-colors"
                            aria-label="Stop generation"
                            title="Stop generation"
                          >
                            <Square className="h-3.5 w-3.5" fill="currentColor" />
                          </button>
                        ) : (
                          <button
                            type="submit"
                            disabled={!canSend}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30 hover:opacity-90"
                            aria-label="Send message"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Context window hairline progress bar — bottom edge of card */}
                    {contextStats !== null && contextStats.pct > 0 && (
                      <div
                        className="absolute bottom-0 left-0 h-[2px] transition-all duration-500"
                        style={{
                          width: `${Math.min(100, contextStats.pct * 100).toFixed(1)}%`,
                          background: contextStats.pct >= 0.8
                            ? "hsl(var(--destructive))"
                            : contextStats.pct >= 0.5
                            ? "#d97706"
                            : "hsl(var(--primary) / 0.4)",
                        }}
                        title={`~${contextStats.totalTokens.toLocaleString()} / ${contextStats.windowSize.toLocaleString()} tokens`}
                      />
                    )}
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
        jwt={jwt}
      />

      <AccountDrawer
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        jwt={jwt}
        userId={userId}
        tier={tier}
        onUpgrade={() => { setAccountDrawerOpen(false); handleUpgrade(); }}
      />

      {/* Global cross-thread search modal */}
      {globalSearchOpen && (() => {
        const q = globalSearchDebounced.trim().toLowerCase();
        const results = globalSearchResults;
        return (
          <>
            <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]" onClick={() => setGlobalSearchOpen(false)} aria-hidden />
            <div role="dialog" aria-modal="true" aria-label="Search all conversations" className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
              <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <SearchCode className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  <input
                    ref={globalSearchInputRef}
                    type="text"
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    placeholder="Search all conversations…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                  <kbd className="hidden sm:inline font-mono text-[10px] text-muted-foreground/40 border border-border rounded px-1">Esc</kbd>
                  <button type="button" onClick={() => setGlobalSearchOpen(false)} className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors ml-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {q.length < 2 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground/50">Type at least 2 characters to search</p>
                  ) : results.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground/50">No matches found</p>
                  ) : (
                    <ul>
                      {results.map((r, i) => {
                        const before = r.snippet.slice(0, r.matchStart);
                        const match = r.snippet.slice(r.matchStart, r.matchStart + q.length);
                        const after = r.snippet.slice(r.matchStart + q.length);
                        return (
                          <li key={`${r.threadId}-${r.messageId}-${i}`} className={cn("border-b border-border/40 last:border-b-0")}>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors"
                              onClick={() => {
                                const thread = threads.find((t) => t.id === r.threadId);
                                if (thread) {
                                  selectThread(thread);
                                  setGlobalSearchOpen(false);
                                  // scroll to message after brief delay for render
                                  setTimeout(() => {
                                    const el = document.getElementById(`msg-${r.messageId}`);
                                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }, 150);
                                }
                              }}
                            >
                              <p className="text-[11px] font-medium text-primary/80 truncate mb-0.5">{r.threadTitle}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {before}
                                <mark className="bg-primary/20 text-foreground rounded-[2px] px-px">{match}</mark>
                                {after}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="px-4 py-2 border-t border-border/40 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {q.length >= 2 ? `${results.length} result${results.length !== 1 ? "s" : ""}` : ""}
                  </span>
                  <kbd className="font-mono text-[10px] text-muted-foreground/40">⌘⇧F</kbd>
                </div>
              </div>
            </div>
          </>
        );
      })()}


      {/* Pro welcome modal — shown once after checkout return */}
      {showProWelcome && (
        <ProWelcomeModal onDismiss={() => setShowProWelcome(false)} />
      )}

      {/* Workspace invite dialog */}
      {inviteDialogWorkspaceId && (
        <InviteDialog
          workspaceId={inviteDialogWorkspaceId}
          open={!!inviteDialogWorkspaceId}
          onClose={() => setInviteDialogWorkspaceId(null)}
        />
      )}
    </>
  );
}
