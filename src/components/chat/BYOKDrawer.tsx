import { useEffect, useRef, useState } from "react";
import { Key, X, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Download, Upload, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { readComposioKey, COMPOSIO_KEY_STORAGE } from "@/components/chat/IntegrationsPanel";

export type Provider = "openrouter" | "anthropic" | "openai" | "google" | "synthetic" | "ollama";

export interface ProviderConfig {
  id: Provider;
  label: string;
  hint: string;
  keyPrefix?: string;
  signupUrl: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "200+ models. Pay-per-token, BYOK or credits.",
    keyPrefix: "sk-or-",
    signupUrl: "https://openrouter.ai/keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "Claude Opus 4.6, Sonnet 4.6, Haiku.",
    keyPrefix: "sk-ant-",
    signupUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT-5.5, GPT-5.4, gpt-4o-mini.",
    keyPrefix: "sk-",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    label: "Google AI",
    hint: "Gemini 2.5 Pro, Gemini 2.5 Flash.",
    keyPrefix: "AIza",
    signupUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "synthetic",
    label: "Synthetic.new",
    hint: "Cheap multi-model gateway. $60/mo unlimited.",
    keyPrefix: "syn_",
    signupUrl: "https://synthetic.new/dashboard",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    hint: "Self-hosted models. No key needed — set URL.",
    signupUrl: "https://ollama.com/download",
  },
];

const STORAGE_KEY = "tag_byok_keys";

// BYOK keys to exclude from export
const BYOK_EXPORT_BLOCKLIST = [STORAGE_KEY, COMPOSIO_KEY_STORAGE, "tag_byok_", "tag_composio_key"];

interface StoredKeys {
  [provider: string]: string;
}

function readKeys(): StoredKeys {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeKeys(keys: StoredKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

// Returns today's date as YYYY-MM-DD
function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Export non-BYOK tag_ keys
function exportSettings() {
  const result: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!key.startsWith("tag_")) continue;
    // Exclude BYOK keys
    if (key === STORAGE_KEY) continue;
    if (key === COMPOSIO_KEY_STORAGE) continue;
    if (key.startsWith("tag_byok_")) continue;
    result[key] = localStorage.getItem(key) ?? "";
  }
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hecz-settings-${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Validate and import settings JSON — never applies BYOK keys
function validateAndImport(raw: string): { ok: boolean; error?: string; count?: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON file." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "File must be a JSON object." };
  }
  // Prototype pollution guard — use Object.hasOwn to check own properties only.
  // The `in` operator checks the prototype chain, so `"constructor" in {}` is always true.
  if (Object.hasOwn(parsed, "__proto__") || Object.hasOwn(parsed, "constructor") || Object.hasOwn(parsed, "prototype")) {
    return { ok: false, error: "Rejected: suspicious keys detected." };
  }
  const obj = parsed as Record<string, unknown>;
  const entries = Object.entries(obj);
  // All keys must start with tag_
  for (const [k] of entries) {
    if (!k.startsWith("tag_")) {
      return { ok: false, error: `Rejected: key "${k}" does not start with "tag_".` };
    }
  }
  // Filter out any BYOK keys that snuck in
  let count = 0;
  for (const [k, v] of entries) {
    if (k === STORAGE_KEY) continue;
    if (k === COMPOSIO_KEY_STORAGE) continue;
    if (k.startsWith("tag_byok_")) continue;
    if (k === "tag_composio_key") continue;
    if (typeof v !== "string") continue;
    localStorage.setItem(k, v);
    count++;
  }
  return { ok: true, count };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onKeysChange?: (keys: StoredKeys) => void;
  /** Supabase JWT for authenticated requests. If null/undefined, download is hidden. */
  // TODO(wave-N): wire jwt from Chat.tsx once prop is wired up the component tree
  jwt?: string | null;
}

export function BYOKDrawer({ open, onClose, onKeysChange, jwt }: Props) {
  const [keys, setKeys] = useState<StoredKeys>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Composio BYOK — separate localStorage key ("tag_composio_key")
  const [composioDraft, setComposioDraft] = useState("");
  const [composioRevealed, setComposioRevealed] = useState(false);

  // Hotkeys panel
  const [hotkeysOpen, setHotkeysOpen] = useState(false);

  // Import state
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Download my data state
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const k = readKeys();
      setKeys(k);
      setDrafts(k);
      setComposioDraft(readComposioKey());
    }
  }, [open]);

  const saveComposio = (value: string) => {
    const trimmed = value.trim();
    try {
      if (trimmed) {
        localStorage.setItem(COMPOSIO_KEY_STORAGE, trimmed);
      } else {
        localStorage.removeItem(COMPOSIO_KEY_STORAGE);
      }
    } catch { /* ignore */ }
    setComposioDraft(trimmed);
  };

  const removeComposio = () => {
    try { localStorage.removeItem(COMPOSIO_KEY_STORAGE); } catch { /* ignore */ }
    setComposioDraft("");
  };

  const save = (provider: Provider, value: string) => {
    const next = { ...keys };
    if (value.trim()) {
      next[provider] = value.trim();
    } else {
      delete next[provider];
    }
    writeKeys(next);
    setKeys(next);
    onKeysChange?.(next);
  };

  const remove = (provider: Provider) => {
    const next = { ...keys };
    delete next[provider];
    writeKeys(next);
    setKeys(next);
    setDrafts({ ...drafts, [provider]: "" });
    onKeysChange?.(next);
  };

  const handleResetAll = () => {
    const first = window.confirm(
      "Are you sure? This deletes all threads, templates, presets, integrations, and BYOK keys."
    );
    if (!first) return;
    const second = window.confirm(
      "This action is irreversible. All local data will be permanently deleted. Proceed?"
    );
    if (!second) return;
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("tag_")) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result;
      if (typeof raw !== "string") {
        setImportError("Could not read file.");
        return;
      }
      const result = validateAndImport(raw);
      if (!result.ok) {
        setImportError(result.error ?? "Import failed.");
      } else {
        setImportSuccess(`Imported ${result.count} setting(s). Reload to apply?`);
        setTimeout(() => {
          if (window.confirm("Settings imported. Reload now to apply them?")) {
            window.location.reload();
          }
        }, 100);
      }
    };
    reader.onerror = () => setImportError("Could not read file.");
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected
    e.target.value = "";
  };

  const handleDownloadData = async () => {
    if (!jwt) return;
    setExportLoading(true);
    setExportError(null);
    try {
      const response = await fetch("/functions/v1/tag-export", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `hecz-export-${todayString()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Could not generate export. Try again.");
    } finally {
      setExportLoading(false);
    }
  };

  if (!open) return null;

  const SHORTCUTS = [
    { keys: "⌘K", action: "New thread" },
    { keys: "⌘⇧O", action: "New thread (alt)" },
    { keys: "⌘/", action: "Focus composer" },
    { keys: "⌘F", action: "Search threads" },
    { keys: "⌘⇧F", action: "Cross-thread search" },
    { keys: "⌘⇧⌫", action: "Clear thread" },
    { keys: "Esc", action: "Close panels" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="BYOK provider keys"
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md",
          "bg-card border-l border-border shadow-xl overflow-y-auto"
        )}
      >
        <header className="sticky top-0 z-10 bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Bring your own keys</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-4 space-y-1.5 text-xs text-muted-foreground bg-primary/5 border-b border-border">
          <p className="font-medium text-foreground">About key storage</p>
          <p>Your keys live only in this browser&apos;s local storage. They never reach our servers for OpenRouter / OpenAI / Synthetic — those requests go direct to the provider. For Anthropic, Google, and Ollama, the request currently routes through our proxy with the key forwarded — keep that in mind.</p>
          <p className="text-destructive/80">Any XSS on hecz.dev could read keys from localStorage. Use a budget-limited key when possible.</p>
        </div>

        <div className="p-4 space-y-4">
          {PROVIDERS.map((provider) => {
            const stored = keys[provider.id];
            const isRevealed = revealed[provider.id];
            const draft = drafts[provider.id] ?? "";

            return (
              <div key={provider.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="font-medium text-sm">{provider.label}</label>
                  <a
                    href={provider.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Get a key →
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">{provider.hint}</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isRevealed ? "text" : "password"}
                      value={draft}
                      onChange={(e) => setDrafts({ ...drafts, [provider.id]: e.target.value })}
                      onBlur={() => save(provider.id, draft)}
                      placeholder={provider.keyPrefix ? `${provider.keyPrefix}...` : "http://localhost:11434"}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setRevealed({ ...revealed, [provider.id]: !isRevealed })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                      aria-label={isRevealed ? "Hide key" : "Show key"}
                    >
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {stored && (
                    <button
                      type="button"
                      onClick={() => remove(provider.id)}
                      className="px-3 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                      aria-label="Remove key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {stored && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Key saved locally
                  </p>
                )}
              </div>
            );
          })}
          {/* ── Composio BYOK ─────────────────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="font-medium text-sm">Composio API Key</label>
              <a
                href="https://composio.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Sign up at composio.dev →
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Agent integrations (Gmail, Slack, GitHub, Linear, Notion, Calendar).
              Your key stays in your browser — Hecz never stores it server-side, only forwards it as a pass-through.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={composioRevealed ? "text" : "password"}
                  value={composioDraft}
                  onChange={(e) => setComposioDraft(e.target.value)}
                  onBlur={() => saveComposio(composioDraft)}
                  placeholder="comp_..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pr-9 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setComposioRevealed((r) => !r)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label={composioRevealed ? "Hide key" : "Show key"}
                >
                  {composioRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {composioDraft && (
                <button
                  type="button"
                  onClick={removeComposio}
                  className="px-3 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                  aria-label="Remove Composio key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {composioDraft && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Key saved locally
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(COMPOSIO_KEY_STORAGE);
                const empty = {};
                setKeys(empty);
                setDrafts({});
                setComposioDraft("");
                onKeysChange?.(empty);
              }}
              className="w-full rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              Clear all keys
            </button>
          </div>

          {/* ── Keyboard shortcuts ──────────────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-2">
            <button
              type="button"
              onClick={() => setHotkeysOpen((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-medium hover:text-foreground text-muted-foreground transition-colors"
            >
              <span>Keyboard shortcuts</span>
              {hotkeysOpen
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />
              }
            </button>
            {hotkeysOpen && (
              <div className="rounded-md border border-border bg-background overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-border text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-1.5">
                  <span>Shortcut</span>
                  <span className="pl-3">Action</span>
                </div>
                {SHORTCUTS.map(({ keys: k, action }) => (
                  <div
                    key={k}
                    className="grid grid-cols-2 divide-x divide-border px-3 py-1.5 text-xs border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-mono text-foreground">{k}</span>
                    <span className="pl-3 text-muted-foreground">{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Export / Import settings ────────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Settings data</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportSettings}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setImportSuccess(null);
                  importInputRef.current?.click();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Import settings
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImportFile}
                aria-hidden
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Export saves all <code className="font-mono">tag_*</code> settings (BYOK keys excluded). Import validates shape and never applies BYOK keys.
            </p>
            {importError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {importError}
              </p>
            )}
            {importSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{importSuccess}</p>
            )}
          </div>

          {/* ── Download my data ────────────────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Download my data</p>
            <p className="text-xs text-muted-foreground">
              Download a complete JSON export of your account: memories, threads in chat_usage, integrations metadata, tool history, shared threads. Sensitive fields (tokens, keys) are excluded.
            </p>
            {jwt ? (
              <>
                <button
                  type="button"
                  onClick={handleDownloadData}
                  disabled={exportLoading}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exportLoading ? "Preparing…" : "Download"}
                </button>
                {exportError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {exportError}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sign in to download your data.</p>
            )}
          </div>

          {/* ── Danger zone ─────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-destructive/30 space-y-2">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Danger zone
            </p>
            <button
              type="button"
              onClick={handleResetAll}
              className="w-full rounded-md border border-destructive px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium"
            >
              Clear all local data
            </button>
            <p className="text-xs text-muted-foreground">
              Permanently deletes all threads, templates, presets, integrations, and BYOK keys from this browser. Cannot be undone.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

export { readKeys as readBYOKKeys };
