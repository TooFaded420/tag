import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import Stripe from "https://esm.sh/stripe@14?target=deno";

import { errorResponse, jsonResponse, optionsResponse } from "../_shared/http.ts";
import { logRequest } from "../_shared/log.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") {
    return errorResponse({ error: "Method not allowed" }, 405);
  }
  const reqStart = Date.now();

  // ── Env guards ──────────────────────────────────────────────────────────────
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    console.error("tag-pro-checkout: STRIPE_SECRET_KEY not configured");
    return errorResponse({ error: "Payment processing not configured." }, 503);
  }

  const stripePriceId = Deno.env.get("STRIPE_TAG_PRO_PRICE_ID");
  if (!stripePriceId) {
    console.error("tag-pro-checkout: STRIPE_TAG_PRO_PRICE_ID not configured");
    return errorResponse({ error: "Tag Pro price not configured." }, 503);
  }

  const siteUrl = Deno.env.get("SITE_URL") || "https://hecz.dev";

  // ── Auth: require valid Supabase JWT ────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return errorResponse({ error: "Missing Authorization: Bearer header" }, 401);
  }
  const jwt = authHeader.slice(7).trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify JWT and get user via anon client (honors RLS)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse({ error: "Unauthorized" }, 401);
  }

  const userId = user.id;
  const customerEmail = user.email ?? "";

  // ── Pre-check: reject if already subscribed ─────────────────────────────────
  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.tier === "pro") {
    return errorResponse({ error: "already_subscribed" }, 409);
  }

  // ── Create Stripe Checkout Session ─────────────────────────────────────────
  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      customer_email: customerEmail || undefined,
      success_url: `${siteUrl}/chat?pro=success`,
      cancel_url: `${siteUrl}/chat?pro=cancelled`,
      metadata: {
        user_id: userId,
        product: "tag-pro",
      },
    });

    logRequest({ route: "tag-pro-checkout", status: "ok", start: reqStart, user_id: userId });
    return jsonResponse({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tag-pro-checkout: Stripe error:", msg);
    logRequest({ route: "tag-pro-checkout", status: "upstream_error", start: reqStart, user_id: userId, error: msg });
    return errorResponse({ error: `Stripe: ${msg}` }, 500);
  }
});
