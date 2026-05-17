-- tag_subscriptions: tracks Stripe subscription state for Tag Pro ($7/mo).
-- Tier column on profiles is updated by the tag-pro-webhook edge function.
-- This table is write-only for the service role (webhook); users read their own row.

CREATE TABLE IF NOT EXISTS public.tag_subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'canceled', 'unpaid', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tag_subscriptions_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_user_id
  ON public.tag_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_stripe_subscription_id
  ON public.tag_subscriptions(stripe_subscription_id);

ALTER TABLE public.tag_subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own subscription row
GRANT SELECT ON public.tag_subscriptions TO authenticated;
-- Service role (webhook) writes; no direct grant needed (service role bypasses RLS)

DROP POLICY IF EXISTS "users read own tag_subscription" ON public.tag_subscriptions;
CREATE POLICY "users read own tag_subscription"
  ON public.tag_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owner (admin) can read all rows for support/admin workflows
DROP POLICY IF EXISTS "owner reads all tag_subscriptions" ON public.tag_subscriptions;
CREATE POLICY "owner reads all tag_subscriptions"
  ON public.tag_subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()));
