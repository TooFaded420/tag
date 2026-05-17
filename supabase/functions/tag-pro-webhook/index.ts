import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import Stripe from "https://esm.sh/stripe@14?target=deno";

/**
 * Verify Stripe webhook signature using Web Crypto API (HMAC-SHA256).
 * Mirrors the pattern in stripe-webhook/index.ts.
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Reject if timestamp is older than 5 minutes
  const ts = parseInt(parts.timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parts.signatures.some((s) => timingSafeStringCompare(s, expectedHex));
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns false immediately on length mismatch (length is not secret in HMAC signatures).
 */
function timingSafeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

serve(async (req: Request) => {
  // Webhooks only come via POST from Stripe — no CORS needed
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── Env guards ──────────────────────────────────────────────────────────────
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("tag-pro-webhook: STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    console.error("tag-pro-webhook: STRIPE_SECRET_KEY not configured");
    return new Response("Stripe key not configured", { status: 500 });
  }

  // ── Signature verification ──────────────────────────────────────────────────
  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    console.error("tag-pro-webhook: Invalid Stripe signature");
    return new Response("Invalid signature", { status: 400 });
  }

  // ── Parse event ─────────────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = JSON.parse(rawBody) as Stripe.Event;
  } catch (err) {
    console.error("tag-pro-webhook: Failed to parse event body", err);
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Service-role Supabase client ─────────────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Event handlers ───────────────────────────────────────────────────────────

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only handle Tag Pro subscriptions — skip other checkout sessions
    if (session.mode !== "subscription" || session.metadata?.product !== "tag-pro") {
      return new Response("OK", { status: 200 });
    }

    const userId = session.client_reference_id ?? session.metadata?.user_id;
    if (!userId) {
      console.error("tag-pro-webhook: No user_id in checkout.session.completed");
      return new Response("OK", { status: 200 });
    }

    const stripeCustomerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
    const stripeSubscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

    // Upsert tag_subscriptions row — dedup on stripe_session_id to handle Stripe retries
    const { error: subError } = await supabase
      .from("tag_subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_session_id: session.id,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_session_id", ignoreDuplicates: true },
      );

    if (subError) {
      console.error("tag-pro-webhook: Failed to upsert tag_subscriptions:", subError);
    }

    // Upgrade profile tier to 'pro'
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ tier: "pro" })
      .eq("id", userId);

    if (profileError) {
      console.error("tag-pro-webhook: Failed to upgrade profile tier:", profileError);
    } else {
      console.log(`tag-pro-webhook: User ${userId} upgraded to pro`);
    }
  } else if (
    event.type === "customer.subscription.deleted" ||
    (event.type === "customer.subscription.updated" &&
      ["canceled", "unpaid", "past_due"].includes(
        (event.data.object as Stripe.Subscription).status,
      ))
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const stripeSubscriptionId = subscription.id;

    // Look up user_id from tag_subscriptions
    const { data: subRow, error: lookupError } = await supabase
      .from("tag_subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (lookupError) {
      console.error("tag-pro-webhook: Failed to look up subscription:", lookupError);
      return new Response(JSON.stringify({ error: lookupError.message }), { status: 500 });
    }

    if (!subRow) {
      // Unknown subscription — not ours, silently ack
      console.log(`tag-pro-webhook: Unknown subscription ${stripeSubscriptionId}, skipping`);
      return new Response("OK", { status: 200 });
    }

    const userId = subRow.user_id;

    // Update tag_subscriptions status (idempotent)
    await supabase
      .from("tag_subscriptions")
      .update({
        status: subscription.status as string,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", stripeSubscriptionId);

    // Downgrade profile tier to 'free'
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ tier: "free" })
      .eq("id", userId);

    if (profileError) {
      console.error("tag-pro-webhook: Failed to downgrade profile tier:", profileError);
    } else {
      console.log(`tag-pro-webhook: User ${userId} downgraded to free (sub status: ${subscription.status})`);
    }
  }

  return new Response("OK", { status: 200 });
});
