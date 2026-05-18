import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Crown, LogOut, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Props {
  open: boolean;
  onClose: () => void;
  jwt: string | null;
  userId: string | null;
  tier: "free" | "pro";
  onUpgrade: () => void;
}

interface UsageState {
  msg_count: number;
  premium_msg_count: number;
}

// Slide-out drawer surfacing account state inside /chat. Replaces the older
// /chat/account full page which felt oversized for what amounts to "your
// email, your tier, today's usage, and the manage-billing button."
export function AccountDrawer({ open, onClose, jwt, userId, tier, onUpgrade }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!open || !jwt || !userId) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
      try {
        const today = new Date().toISOString().slice(0, 10);
        // deno-lint-ignore no-explicit-any
        const { data: u } = await (supabase as any)
          .from("chat_usage")
          .select("msg_count, premium_msg_count")
          .eq("user_id", userId)
          .eq("day", today)
          .maybeSingle();
        if (u) setUsage({ msg_count: u.msg_count ?? 0, premium_msg_count: u.premium_msg_count ?? 0 });
        else setUsage({ msg_count: 0, premium_msg_count: 0 });
      } catch {
        setUsage({ msg_count: 0, premium_msg_count: 0 });
      }
    })();
  }, [open, jwt, userId]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    onClose();
  }

  async function handleManageBilling() {
    if (!jwt) return;
    setPortalLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tag-pro-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      });
      const body = await res.json();
      if (body.url) window.location.href = body.url;
    } catch {
      window.location.href = "https://billing.stripe.com/p/login/cN200u0Fv2Lq4t69AA";
    } finally {
      setPortalLoading(false);
    }
  }

  const dailyMsgLimit = 50;
  const dailyPremiumLimit = tier === "pro" ? 100 : 0;
  const msgUsed = usage?.msg_count ?? 0;
  const premiumUsed = usage?.premium_msg_count ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl transition-transform duration-200 overflow-y-auto",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Account"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Account
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account drawer"
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-5">
          {/* Identity */}
          <div>
            <h2 className="text-lg font-semibold truncate" title={email ?? ""}>
              {email ?? "—"}
            </h2>
            <div className="mt-2 inline-flex items-center gap-2">
              {tier === "pro" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <Crown className="h-3 w-3" />
                  Pro
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Free
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-mono">{userId?.slice(0, 8)}…</span>
            </div>
          </div>

          {/* Usage */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Today
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Messages</span>
                  <span className="font-mono">{msgUsed} / {dailyMsgLimit}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (msgUsed / dailyMsgLimit) * 100)}%` }}
                  />
                </div>
              </div>
              {tier === "pro" && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Premium (Kimi, GLM-5.1, MiniMax, Nemotron)</span>
                    <span className="font-mono">{premiumUsed} / {dailyPremiumLimit}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (premiumUsed / dailyPremiumLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/70">
              Resets at midnight UTC. BYOK requests don't count.
            </p>
          </section>

          {/* Plan */}
          <section className="border-t border-border/60 pt-5">
            <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Plan
            </h3>
            {tier === "pro" ? (
              <>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  You're on Pro. $7/month. Thanks for supporting Tag.
                </p>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {portalLoading ? "Opening…" : "Manage billing"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  Upgrade for Kimi-K2.6, GLM-5.1, MiniMax-M2.5, Nemotron, multi-model compare, file upload + RAG, and Agent mode.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    Upgrade · $7/mo
                  </button>
                  <Link
                    to="/chat/pricing"
                    onClick={onClose}
                    className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    Compare plans
                  </Link>
                </div>
              </>
            )}
          </section>

          {/* Sign out */}
          <section className="border-t border-border/60 pt-5">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
