import { useEffect, useState } from "react";
import { Key, X, Eye, EyeOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface Props {
  open: boolean;
  onClose: () => void;
  onKeysChange?: (keys: StoredKeys) => void;
}

export function BYOKDrawer({ open, onClose, onKeysChange }: Props) {
  const [keys, setKeys] = useState<StoredKeys>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const k = readKeys();
      setKeys(k);
      setDrafts(k);
    }
  }, [open]);

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

  if (!open) return null;

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
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                const empty = {};
                setKeys(empty);
                setDrafts({});
                onKeysChange?.(empty);
              }}
              className="w-full rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              Clear all keys
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export { readKeys as readBYOKKeys };
