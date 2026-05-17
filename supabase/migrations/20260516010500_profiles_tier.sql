-- Tag chat product: tier column on profiles for free/pro gating
-- Used by synthetic-public-proxy edge fn to enforce per-tier model whitelists.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'pro'));

CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier) WHERE tier = 'pro';

COMMENT ON COLUMN public.profiles.tier IS
  'Subscription tier: free (default) or pro ($7/mo). Updated by Stripe webhook on subscription state change.';
