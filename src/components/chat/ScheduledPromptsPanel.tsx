/**
 * ScheduledPromptsPanel — collapsible sidebar panel for managing scheduled prompts.
 *
 * Users save a name + prompt text + cron expression. The panel lists saved schedules
 * with enabled toggle, last_run relative time, edit/delete controls, and an inline
 * creation/edit form with common cron presets.
 *
 * NOTE: This is the data layer + UI only. The actual cron runner that fires these
 * prompts will be a separate edge fn (tag-schedule-runner) invoked by pg_cron.
 * TODO: tag-schedule-runner will be a separate edge fn invoked by pg_cron.
 */

// TODO: Update types after migration applied
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/tag-scheduled-prompts`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduledPrompt {
  id: string;
  name: string;
  prompt_text: string;
  cron_expression: string;
  model: string | null;
  system_prompt: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduledPromptsPanelProps {
  jwt: string | null;
}

// ── Cron presets ──────────────────────────────────────────────────────────────

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Weekday 8am", value: "0 8 * * 1-5" },
  { label: "Daily 9am", value: "0 9 * * *" },
  { label: "Weekly Mon 8am", value: "0 8 * * 1" },
  { label: "Monthly 1st 9am", value: "0 9 1 * *" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "never";
  const diffMs = Date.now() - new Date(isoStr).getTime();
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

async function apiCall(
  jwt: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }));
    throw Object.assign(new Error(String((err as any)?.error ?? "request failed")), {
      status: res.status,
      body: err,
    });
  }
  return res.json();
}

// ── Blank form state ──────────────────────────────────────────────────────────

interface FormState {
  name: string;
  prompt_text: string;
  cron_expression: string;
  enabled: boolean;
}

const BLANK_FORM: FormState = {
  name: "",
  prompt_text: "",
  cron_expression: "",
  enabled: true,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ScheduledPromptsPanel({ jwt }: ScheduledPromptsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [prompts, setPrompts] = useState<ScheduledPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — null = closed, "create" = new, string id = editing
  const [formMode, setFormMode] = useState<null | "create" | string>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-row action states
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadPrompts = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await apiCall(jwt, { action: "list" })) as {
        prompts: ScheduledPrompt[];
      };
      setPrompts(data.prompts ?? []);
    } catch {
      setError("Failed to load scheduled prompts");
    } finally {
      setLoading(false);
    }
  }, [jwt]);

  useEffect(() => {
    if (expanded && jwt) {
      void loadPrompts();
    }
  }, [expanded, jwt, loadPrompts]);

  // ── Open form ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(BLANK_FORM);
    setFormError(null);
    setFormMode("create");
  };

  const openEdit = (p: ScheduledPrompt) => {
    setForm({
      name: p.name,
      prompt_text: p.prompt_text,
      cron_expression: p.cron_expression,
      enabled: p.enabled,
    });
    setFormError(null);
    setFormMode(p.id);
  };

  const closeForm = () => {
    setFormMode(null);
    setFormError(null);
  };

  // ── Save (create or update) ────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!jwt || !formMode) return;
    setSaving(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await apiCall(jwt, { action: "create", ...form });
      } else {
        await apiCall(jwt, { action: "update", id: formMode, ...form });
      }
      closeForm();
      await loadPrompts();
    } catch (err) {
      const e = err as Error & { body?: { error?: string } };
      setFormError(e?.body?.error ?? e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [jwt, formMode, form, loadPrompts]);

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (id: string) => {
      if (!jwt) return;
      setToggling(id);
      try {
        const data = (await apiCall(jwt, { action: "toggle", id })) as {
          prompt: { id: string; enabled: boolean };
        };
        setPrompts((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, enabled: data.prompt.enabled } : p,
          ),
        );
      } catch {
        // ignore — stale state will correct on next load
      } finally {
        setToggling(null);
      }
    },
    [jwt],
  );

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!jwt) return;
      if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
      setDeleting(id);
      try {
        await apiCall(jwt, { action: "delete", id });
        setPrompts((prev) => prev.filter((p) => p.id !== id));
        if (formMode === id) closeForm();
      } catch {
        setError("Failed to delete prompt");
      } finally {
        setDeleting(null);
      }
    },
    [jwt, formMode],
  );

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!jwt) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="border-t border-border/40">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-mono uppercase tracking-widest text-[10px]">
          Scheduled Prompts
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Error banner */}
          {error && (
            <p className="text-[10px] text-destructive px-0.5">{error}</p>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-1.5">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-7 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          )}

          {/* Prompt list */}
          {!loading && prompts.length > 0 && (
            <ul className="space-y-0.5">
              {prompts.map((p) => (
                <li
                  key={p.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  {/* Enabled dot */}
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      p.enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
                    )}
                    aria-hidden
                  />

                  {/* Name + cron */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground truncate leading-none">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                      {p.cron_expression}
                    </p>
                  </div>

                  {/* Last run */}
                  <span className="shrink-0 text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatRelativeTime(p.last_run_at)}
                  </span>

                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggle(p.id)}
                    disabled={toggling === p.id}
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-colors disabled:opacity-50",
                      p.enabled
                        ? "text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20"
                        : "text-muted-foreground bg-muted hover:bg-muted/80",
                    )}
                    aria-label={p.enabled ? "Disable schedule" : "Enable schedule"}
                  >
                    {toggling === p.id ? "…" : p.enabled ? "On" : "Off"}
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="hidden group-hover:inline-flex items-center rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    className="hidden group-hover:inline-flex items-center rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    aria-label={`Delete ${p.name}`}
                  >
                    {deleting === p.id ? "…" : <Trash2 className="h-3 w-3" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!loading && prompts.length === 0 && formMode === null && (
            <p className="text-[10px] text-muted-foreground px-0.5 leading-snug">
              No scheduled prompts yet. Add one to run a prompt automatically on a cron schedule.
            </p>
          )}

          {/* Add new button */}
          {formMode === null && (
            <button
              type="button"
              onClick={openCreate}
              className="w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add schedule
            </button>
          )}

          {/* Inline form */}
          {formMode !== null && (
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-3 space-y-2.5">
              <p className="text-[11px] font-medium text-foreground">
                {formMode === "create" ? "New scheduled prompt" : "Edit schedule"}
              </p>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Morning Gmail summary"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Prompt text */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                  Prompt
                </label>
                <textarea
                  value={form.prompt_text}
                  maxLength={12_000}
                  rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, prompt_text: e.target.value }))}
                  placeholder="e.g. Summarize my unread Gmail messages and highlight anything urgent."
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Cron expression */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                  Cron expression
                </label>
                {/* Presets */}
                <div className="flex flex-wrap gap-1">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, cron_expression: preset.value }))}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] transition-colors border",
                        form.cron_expression === preset.value
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={form.cron_expression}
                  onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                  placeholder="0 8 * * 1-5"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[9px] text-muted-foreground leading-snug">
                  Standard 5-field cron: minute hour day month weekday
                </p>
              </div>

              {/* Enabled checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-[11px] text-foreground">Enabled</span>
              </label>

              {/* Form error */}
              {formError && (
                <p className="text-[10px] text-destructive">{formError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.prompt_text.trim() || !form.cron_expression.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-[11px] text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
