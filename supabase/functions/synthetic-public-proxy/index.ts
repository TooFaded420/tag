import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonResponse,
  optionsResponse,
  errorResponse,
  readJson,
} from "../_shared/http.ts";
import { logRequest } from "../_shared/log.ts";

const SYNTHETIC_API_KEY = Deno.env.get("SYNTHETIC_API_KEY");
const SYNTHETIC_BASE_URL =
  Deno.env.get("SYNTHETIC_BASE_URL") ?? "https://api.synthetic.new/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// Tier-based model whitelists
// ─────────────────────────────────────────────────────────────────────────────
const ANON_MODELS = new Set(["hf:openai/gpt-oss-120b"]);
const FREE_MODELS = new Set([...ANON_MODELS, "hf:zai-org/GLM-4.7-Flash"]);
const PRO_MODELS = new Set([
  ...FREE_MODELS,
  "hf:moonshotai/Kimi-K2.6",
  "hf:zai-org/GLM-5.1",
  "hf:MiniMaxAI/MiniMax-M2.5",
  "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
]);

// Premium models consume the premium_msg_count quota bucket
const PREMIUM_MODELS = new Set([
  "hf:moonshotai/Kimi-K2.6",
  "hf:zai-org/GLM-5.1",
  "hf:MiniMaxAI/MiniMax-M2.5",
  "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
]);

// Daily limits per tier: { msg, premium }
const TIER_LIMITS: Record<string, { msg: number; premium: number }> = {
  anon: { msg: 10, premium: 0 },
  free: { msg: 50, premium: 0 },
  pro: { msg: 50, premium: 100 },
};

// BYOK provider → upstream endpoint
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  google:
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};

// ─────────────────────────────────────────────────────────────────────────────
// Anon session token — 30-minute HMAC-signed token so users verify Turnstile
// once and reuse the session for up to 30 minutes without re-verifying.
//
// Token format v2: v1:anon-chat:<ip_hash>:<iat_ms>:<exp_ms>:<sig_base64url>
// HMAC body:       v1:anon-chat:<ip_hash>:<iat_ms>:<exp_ms>
//
// Legacy format (no version prefix): <ip_hash>:<exp_ms>:<sig_base64url>
// Accepted during grace window (legacy tokens expire naturally within 30 min).
// TODO(cleanup): remove legacy path after 2026-06-16 (30 days from ship).
// ─────────────────────────────────────────────────────────────────────────────

const ANON_SESSION_TTL_MS = 30 * 60 * 1000;

async function getHmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("INTERNAL_SHARED_SECRET");
  if (!secret) throw new Error("INTERNAL_SHARED_SECRET missing");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(s.length / 4) * 4,
    "=",
  );
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function signAnonSession(payload: { ip_hash: string; expires_at: number }): Promise<string> {
  const iat = Date.now();
  const exp = payload.expires_at;
  const body = `v1:anon-chat:${payload.ip_hash}:${iat}:${exp}`;
  const key = await getHmacKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const sig = toBase64url(sigBuf);
  return `${body}:${sig}`;
}

async function verifyAnonSession(token: string, _expectedIpHash: string): Promise<boolean> {
  // NOTE: IP binding intentionally NOT enforced. See commit 31dfd28 for rationale.
  // HMAC signature + 30-min expiry is sufficient anti-abuse; quota is still
  // tracked per IP server-side.
  try {
    const key = await getHmacKey();

    // ── v2 path: v1:anon-chat:<ip_hash>:<iat_ms>:<exp_ms>:<sig> ─────────────
    if (token.startsWith("v1:anon-chat:")) {
      // Format: v1:anon-chat:<ip_hash>:<iat_ms>:<exp_ms>:<sig>
      // Split from the right to isolate sig; ip_hash itself may contain colons.
      const lastColon = token.lastIndexOf(":");
      if (lastColon < 0) return false;
      const body = token.slice(0, lastColon);
      const sigProvided = token.slice(lastColon + 1);

      // Extract exp from body (5th colon-delimited field: v1:anon-chat:<ip>:<iat>:<exp>)
      const bodyParts = body.split(":");
      if (bodyParts.length < 5) return false;
      const expStr = bodyParts[bodyParts.length - 1];
      const exp = parseInt(expStr, 10);
      if (Number.isNaN(exp) || exp < Date.now()) return false;

      // Constant-time compare via timingSafeEqual on raw signature bytes
      const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      const expectedBytes = new Uint8Array(sigBuf);
      let providedBytes: Uint8Array;
      try {
        providedBytes = fromBase64url(sigProvided);
      } catch {
        return false;
      }
      if (providedBytes.length !== expectedBytes.length) return false;
      return crypto.subtle.timingSafeEqual(providedBytes, expectedBytes);
    }

    // ── Legacy path: <ip_hash>:<exp_ms>:<sig> ────────────────────────────────
    // TODO(cleanup): remove after 2026-06-16 (30 days from ship).
    const parts = token.split(":");
    if (parts.length < 3) return false;
    const legacySig = parts[parts.length - 1];
    const legacyExpStr = parts[parts.length - 2];
    const legacyIpHash = parts.slice(0, parts.length - 2).join(":");
    if (!legacyIpHash || !legacyExpStr || !legacySig) return false;
    const legacyExp = parseInt(legacyExpStr, 10);
    if (Number.isNaN(legacyExp) || legacyExp < Date.now()) return false;

    // Re-sign using legacy format to compare
    const legacyBody = `${legacyIpHash}:${legacyExpStr}`;
    const legacySigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(legacyBody));
    const legacyExpectedBytes = new Uint8Array(legacySigBuf);
    let legacyProvidedBytes: Uint8Array;
    try {
      legacyProvidedBytes = fromBase64url(legacySig);
    } catch {
      return false;
    }
    if (legacyProvidedBytes.length !== legacyExpectedBytes.length) return false;
    return crypto.subtle.timingSafeEqual(legacyProvidedBytes, legacyExpectedBytes);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Tier = "anon" | "free" | "pro";

// deno-lint-ignore no-explicit-any
async function getUserTier(supabase: any, userId: string | null): Promise<Tier> {
  if (!userId) return "anon";

  // TODO: profiles.tier column does not exist yet — add it when the
  // Pro subscription tier is wired up (see docs/synthetic-public-proxy.md).
  // Once the column exists, remove the try/catch and let the error surface.
  try {
    const { data } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle();
    return ((data?.tier as Tier) ?? "free") as Tier;
  } catch {
    // profiles.tier column not yet present — default signed-in users to 'free'
    return "free";
  }
}

function isModelAllowed(tier: Tier, model: string): boolean {
  if (tier === "pro") return PRO_MODELS.has(model);
  if (tier === "free") return FREE_MODELS.has(model);
  return ANON_MODELS.has(model);
}

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Reasoning model normalization (same logic as synthetic-proxy)
// Reasoning models (Kimi-K2.6, GLM-5.1, DeepSeek-R1) return chain-of-thought
// in message.reasoning and may leave message.content null.
// ─────────────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function normalizeReasoningChoice(choice: any): any {
  if (!choice?.message) return choice;

  const msg = choice.message;

  // If content is already populated, nothing to do
  if (typeof msg.content === "string" && msg.content.trim().length > 0) {
    return choice;
  }

  // Reasoning model fallback: extract content from reasoning field
  const reasoning = typeof msg.reasoning === "string" ? msg.reasoning : "";
  if (!reasoning) return choice;

  let extracted: string | null = null;

  // Pattern A: trailing JSON object (most reliable for structured output)
  const jsonMatch = reasoning.match(/\{[\s\S]*\}\s*$/);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[0]); // validate
      extracted = jsonMatch[0];
    } catch {
      // not valid JSON, try next pattern
    }
  }

  // Pattern B: <answer>...</answer> tags
  if (!extracted) {
    const tagMatch = reasoning.match(/<answer>\s*([\s\S]+?)\s*<\/answer>/i);
    if (tagMatch) extracted = tagMatch[1].trim();
  }

  // Pattern C: "Final answer:" or "Answer:" prefix on a line
  if (!extracted) {
    const ansMatch = reasoning.match(
      /(?:^|\n)\s*(?:final answer|answer)\s*[:-]\s*([\s\S]+?)(?:\n\n|$)/i,
    );
    if (ansMatch) extracted = ansMatch[1].trim();
  }

  // Pattern D: last non-empty paragraph
  if (!extracted) {
    const paragraphs = reasoning
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      extracted = paragraphs[paragraphs.length - 1];
    }
  }

  // Fallback: use full reasoning as content
  if (!extracted) extracted = reasoning;

  return {
    ...choice,
    message: {
      ...msg,
      content: extracted,
      reasoning: msg.reasoning, // preserve original for callers that want it
    },
    _reasoning_normalized: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Client IP extraction
//
// Supabase Edge Functions are fronted by Cloudflare. Cloudflare strips any
// client-supplied `cf-connecting-ip` header and replaces it with the actual
// TCP peer IP, so it is always trustworthy. For `x-forwarded-for`, Cloudflare
// APPENDS the real client IP at the rightmost position (it does not strip
// prior values), so we take the last entry rather than the first.
// Source: https://developers.cloudflare.com/fundamentals/reference/http-request-headers/
// ─────────────────────────────────────────────────────────────────────────────
function getClientIp(req: Request): string {
  // Cloudflare sets this from the actual TCP peer; client-supplied value is stripped.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  // x-forwarded-for is appended to by each proxy; rightmost entry is the most
  // recently added (Cloudflare's view of the real client) and is most trusted.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "0.0.0.0";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return errorResponse({ error: "POST required" }, 405);

  if (!SYNTHETIC_API_KEY) {
    console.error("SYNTHETIC_API_KEY not set");
    return errorResponse(
      {
        error: "synthetic.new not configured",
        hint: "Set SYNTHETIC_API_KEY in Supabase project secrets dashboard",
      },
      503,
    );
  }

  const ip = getClientIp(req);

  // ── Auth: extract JWT if present ─────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Supabase client (anon key — for auth.getUser and RPC)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { authorization: authHeader } : {} },
  });

  let userId: string | null = null;
  if (jwt) {
    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data?.user) {
      return errorResponse({ error: "Invalid or expired JWT" }, 401);
    }
    userId = data.user.id;
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    max_tokens?: number;
    turnstile_token?: string;
    anon_session_token?: string;
    byok_provider?: string;
    byok_key?: string;
  };
  try {
    body = await readJson(req);
  } catch {
    return errorResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return errorResponse({ error: "messages array required" }, 400);
  }
  if (!body.model || typeof body.model !== "string") {
    return errorResponse({ error: "model field required" }, 400);
  }

  // Request-level timer for structured observability logs
  const reqStart = Date.now();

  // ── Turnstile verification (anon path only) ───────────────────────────────
  // After a successful Turnstile verify we issue a 30-min HMAC session token
  // so the client can skip re-verification on subsequent messages.
  let newAnonSessionToken: string | null = null;

  if (!userId) {
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      console.error("TURNSTILE_SECRET_KEY not set — rejecting anon request");
      return errorResponse(
        {
          error: "Turnstile not configured",
          hint: "Set TURNSTILE_SECRET_KEY in Supabase project secrets dashboard",
        },
        503,
      );
    }

    const ipHash = await sha256(ip);

    // Fast path: reuse an existing valid anon session token.
    if (body.anon_session_token) {
      const valid = await verifyAnonSession(body.anon_session_token, ipHash);
      if (!valid) {
        return errorResponse(
          { error: "Verify you are human, then we'll keep you signed in for 30 minutes." },
          400,
        );
      }
      // Session is valid — skip Turnstile entirely.
    } else {
      // Slow path: require a fresh Turnstile token.
      if (!body.turnstile_token) {
        return errorResponse(
          { error: "Verify you are human, then we'll keep you signed in for 30 minutes." },
          400,
        );
      }

      const tsRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: body.turnstile_token,
            remoteip: ip,
          }),
        },
      );
      const tsData = await tsRes.json();
      if (!tsData.success) {
        logRequest({
          route: "synthetic-public-proxy",
          status: "turnstile_failed",
          start: reqStart,
          tier: "anon",
          model: body.model,
          upstream_latency_ms: -1,
          ip_hash: (await sha256(ip)).slice(0, 8),
        });
        return errorResponse({ error: "Turnstile verification failed" }, 403);
      }

      // Validate hostname — accept production domain or localhost for dev.
      const expectedHostname = Deno.env.get("TURNSTILE_EXPECTED_HOSTNAME") ?? "hecz.dev";
      if (tsData.hostname && tsData.hostname !== expectedHostname && tsData.hostname !== "localhost") {
        return errorResponse({ error: "turnstile_hostname_mismatch" }, 403);
      }

      // Validate action — must exactly match what TurnstileGate.tsx sends.
      if (tsData.action && tsData.action !== "anon_chat") {
        return errorResponse({ error: "turnstile_action_mismatch" }, 403);
      }

      // Issue a new 30-min session token so the client avoids re-verifying.
      try {
        newAnonSessionToken = await signAnonSession({
          ip_hash: ipHash,
          expires_at: Date.now() + ANON_SESSION_TTL_MS,
        });
      } catch (err) {
        // Non-fatal: log and continue without issuing a session token.
        console.warn("signAnonSession failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  // ── Tier resolution ───────────────────────────────────────────────────────
  const tier = await getUserTier(supabase, userId);

  // ── Model whitelist (skip for BYOK) ──────────────────────────────────────
  if (!body.byok_key) {
    if (!isModelAllowed(tier, body.model)) {
      return errorResponse(
        {
          error: "Model not allowed for your tier",
          upgrade_url: "https://hecz.dev/pricing",
          your_tier: tier,
          requested_model: body.model,
        },
        402,
      );
    }
  }

  // ── Quota check + increment (skip for BYOK) ───────────────────────────────
  if (!body.byok_key) {
    const ipHash = await sha256(ip);
    const isPremium = PREMIUM_MODELS.has(body.model);

    const l = TIER_LIMITS[tier];
    const { data: usage, error: usageError } = await supabase.rpc(
      "increment_chat_usage",
      {
        p_user_id: userId ?? null,
        p_ip_hash: userId ? null : ipHash,
        p_is_premium: isPremium,
        p_msg_limit: l.msg,
        p_premium_limit: l.premium,
      },
    );

    if (usageError) {
      console.error("increment_chat_usage RPC error:", usageError.message);
      return errorResponse({ error: "Quota tracking error" }, 500);
    }

    if (usage.quota_exceeded) {
      logRequest({
        route: "synthetic-public-proxy",
        status: "quota_exceeded",
        start: reqStart,
        tier,
        model: body.model,
        upstream_latency_ms: -1,
        user_id: userId ?? undefined,
        ip_hash: !userId ? ipHash.slice(0, 8) : undefined,
      });
      return errorResponse(
        {
          error: "Daily quota exceeded",
          your_tier: tier,
          used: { msg_count: usage.msg_count, premium_msg_count: usage.premium_msg_count },
          limits: l,
          upgrade_url: tier === "pro" ? null : "https://hecz.dev/pricing",
        },
        429,
      );
    }
  }

  // ── Build upstream request ────────────────────────────────────────────────
  const isByok = !!body.byok_key;
  const upstreamUrl = isByok
    ? (PROVIDER_ENDPOINTS[body.byok_provider ?? ""] ??
        "https://api.synthetic.new/v1/chat/completions")
    : `${SYNTHETIC_BASE_URL}/chat/completions`;

  const upstreamKey = isByok ? body.byok_key : SYNTHETIC_API_KEY;

  const payload = {
    model: body.model,
    messages: body.messages,
    temperature: body.temperature ?? 0.7,
    max_tokens: body.max_tokens ?? 4096,
  };

  try {
    const upstreamStart = Date.now();
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${upstreamKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const upstreamLatencyMs = Date.now() - upstreamStart;

    const data = await upstream.json();
    if (!upstream.ok) {
      logRequest({
        route: "synthetic-public-proxy",
        status: "upstream_error",
        start: reqStart,
        tier,
        model: body.model,
        upstream_latency_ms: upstreamLatencyMs,
        upstream_status: upstream.status,
        user_id: userId ?? undefined,
        ip_hash: !userId ? (await sha256(ip)).slice(0, 8) : undefined,
      });
      return errorResponse(
        { error: "upstream error", status: upstream.status, detail: data },
        502,
      );
    }

    // Normalize reasoning model responses so callers always get message.content
    if (data?.choices && Array.isArray(data.choices)) {
      data.choices = data.choices.map(normalizeReasoningChoice);
    }

    const responseInit: ResponseInit | undefined = newAnonSessionToken
      ? { headers: { "X-Anon-Session": newAnonSessionToken } }
      : undefined;

    logRequest({
      route: "synthetic-public-proxy",
      status: isByok ? "byok_passthrough" : "ok",
      start: reqStart,
      tier,
      model: body.model,
      upstream_latency_ms: upstreamLatencyMs,
      user_id: userId ?? undefined,
      ip_hash: !userId ? (await sha256(ip)).slice(0, 8) : undefined,
    });

    return jsonResponse(
      {
        ok: true,
        model: data.model ?? payload.model,
        choices: data.choices,
        usage: data.usage,
      },
      responseInit,
    );
  } catch (err) {
    logRequest({
      route: "synthetic-public-proxy",
      status: "upstream_error",
      start: reqStart,
      tier,
      model: body.model,
      upstream_latency_ms: -1,
      error: err instanceof Error ? err.message : "unknown",
      user_id: userId ?? undefined,
      ip_hash: !userId ? (await sha256(ip)).slice(0, 8) : undefined,
    });
    return errorResponse({ error: "internal error" }, 500);
  }
});
