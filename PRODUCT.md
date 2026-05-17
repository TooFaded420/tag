# Tag — Multi-Model Chat for Builders

**Product layer of hecz.dev.** A free + Pro multi-model AI chat that runs on hecz.dev/chat. Open source. BYOK-first. Sustainable free tier via synthetic.new.

## What we're building

Tag is a chat surface that lets a user pick from many AI models (Claude, GPT, Gemini, Kimi, GLM, gpt-oss-120b, more) and either:
- **BYOK** — bring their own API key for any provider (OpenRouter, Anthropic, OpenAI, Google, synthetic.new, Ollama local)
- **Use our starter** — synthetic.new free tier with daily quotas

Pro tier ($7/mo) unlocks productivity features (Mem0 persistent memory, multi-model compare, file upload + RAG, premium-model access on our synthetic.new sub, BYOK no-throttle).

Open source. MIT licensed. Repo mirror lives at `github.com/TooFaded420/tag` (or wherever JR pushes it).

## Brand

- **Name:** Tag
- **Tagline:** "Tag every model. Get the best answer."
- **Visual:** Graffiti-tag logo (extends hecz.dev brand). Mauve `#8B7DA8` accent.
- **Logo TODO:** generate via Higgsfield, save to `/public/logos/tag-logo.{png,webp}`

## Where it lives

- **URL:** `hecz.dev/chat` (sub-route)
- **Nav:** Add 4th pill `Chat` to existing floating pill nav (next to Blog · Starter Kit · HQ)
- **Open-source repo:** `github.com/TooFaded420/tag` (separate public repo mirroring the chat code via CI sync)

## Tier matrix

| Tier | Price | Models | Daily limit | Features | BYOK |
|---|---|---|---|---|---|
| **Anon** | $0, no signup | gpt-oss-120b only | 10 msg/day per IP | None | No |
| **Free** | $0, signed in | gpt-oss-120b + GLM-4.7-Flash | 50 msg/day | Last-5-chats lightweight memory, 1 model at a time | Yes (any provider) |
| **Pro** | $7/mo | All Free models PLUS Kimi-K2.6, GLM-5.1, MiniMax-M2.5, Nemotron via synthetic | 50 cheap + 100 premium/day | Full Mem0 + Multi-model compare + File upload + RAG + BYOK no-throttle | Yes + no throttle |

## Architecture decisions

- **BYOK key storage:** Client-only localStorage. Never on our servers. Sent direct browser→provider for each request. Zero liability for us.
- **Mem0:** Self-host on Supabase pgvector. Per-user memory namespace via `auth.uid()`. No vendor lock-in. Schema in `supabase/migrations/`.
- **Anon abuse:** IP-based rate limit + Cloudflare Turnstile captcha at message 1. Existing INTERNAL_SHARED_SECRET gate on synthetic-proxy needs a public-safe counterpart.
- **Quota tracking:** New `chat_usage` table — `(id, user_id nullable, ip_hash, day, msg_count, premium_msg_count)`. Atomic increment via RPC. Cleanup job deletes rows older than 30 days.
- **UI:** Vercel AI SDK + assistant-ui.
- **Edge functions needed (new):**
  - `synthetic-public-proxy` — Turnstile-verified anon variant of synthetic-proxy
  - `chat-usage-increment` — atomic quota tracker RPC wrapper
  - `mem0-search`, `mem0-write` — memory operations
- **Existing functions reused:** `synthetic-proxy` (signed-in calls), Stripe checkout for Pro upgrade

## Build sequence (3 weeks)

### Week 1 — Anon + Free MVP

Ship a working chat. No memory, no Pro tier, no multi-model compare. Just chat with model picker + BYOK + free synthetic starter.

- New `synthetic-public-proxy` edge fn with Turnstile verify
- New `chat_usage` migration + increment RPC
- New `/chat` page with assistant-ui Thread + Vercel AI SDK `useChat`
- Model picker dropdown (gpt-oss-120b free for anon; +GLM-Flash for free signed-in; +6 premium models gated for Pro)
- BYOK provider drawer (paste keys into localStorage, never sent to our server)
- Turnstile widget at message 1 for anon users
- Add `Chat` pill to floating nav
- Launch blog post: "I built a free multi-model AI chat — here's what I learned"

### Week 2 — Mem0 + memory

Add the stickiness driver.

- pgvector migration for `chat_memories` table (user_id, embedding, content, importance, created_at)
- `mem0-search` + `mem0-write` edge functions (use synthetic-proxy for embedding)
- Memory injection into system prompt on each chat request
- "I remember:" sidebar panel showing top memories for current user
- Light memory for Free tier (last 5 chats summary), Full Mem0 for Pro

### Week 3 — Pro tier + Stripe + premium models + multi-model compare + file upload

Make money.

- `quick_orders`-style Stripe Pro SKU at $7/mo (subscription)
- Webhook updates `profiles.tier = 'pro'`
- Pro-gated route on synthetic-public-proxy for Kimi/GLM-5.1/MiniMax/Nemotron
- Multi-model compare: split-screen UI sends same prompt to 3 selected models, shows side-by-side
- File upload: drop PDF/MD/code, extract text via existing pattern, append to system prompt + write to Mem0
- Launch blog post: "Tag goes Pro — multi-model compare for $7"

## Open-source repo plan

- Public repo: `github.com/TooFaded420/tag`
- License: MIT
- CI sync from hecz private monorepo → public mirror on every push to main (GitHub Action filters to `src/chat/**` + the relevant edge functions)
- Public README points users to `hecz.dev/chat` for the hosted version
- Self-hosting guide for devs who want to run their own

## Success metrics

- **Week 1:** chat live on hecz.dev/chat, 10+ anon users tested, 5+ signed-in
- **Week 2:** Mem0 live, 20+ memories stored across users
- **Week 3:** Pro tier live, first paying customer
- **Month 2:** 100+ email subscribers from chat → newsletter funnel, 5+ Pro subs, 1+ Quick Site $500 sale traceable to chat traffic

## Out of scope (v1)

- Image generation (separate skill, future)
- Voice input/output (future)
- Native iOS/Android apps (web-only)
- Team plans / org accounts (Pro is solo)
- Custom model fine-tuning
- Hosted agent/automation builder

## Runtime context

- **Frontend:** Vite 5+ build, React 18, TypeScript strict mode, Tailwind v4 utility classes, Radix/shadcn UI primitives. Deployed to Vercel (auto on push to main). Node 22+ build env. Public env vars prefixed `VITE_`. Bundle target ESNext.
- **Backend:** Supabase project `gbuzohuntmqqtoipavdr`. Postgres 17 with pgvector extension. Edge Functions on Deno runtime. Migrations in `supabase/migrations/`. RLS-first on every new table. GitHub Action handles edge fn deploys + db migrations.
- **Auth:** Supabase Auth (email + Google OAuth wired). `profiles` table with `is_owner()` check. Anon = no row, Free = row with `tier='free'`, Pro = `tier='pro'` (column TODO if not present).
- **Secrets:** Server side in Supabase secrets (`INTERNAL_SHARED_SECRET`, `SYNTHETIC_API_KEY`, `SYNTHETIC_BASE_URL`, `SYNTHETIC_DEFAULT_MODEL=hf:openai/gpt-oss-120b`, `STRIPE_*`, `TURNSTILE_*`). Client side via Vercel env vars (`VITE_*`).
- **Build CI:** `npm run build` must exit 0 before any commit. Pre-commit checklist in `docs/PRE_COMMIT_CHECKLIST.md`. Lint via ESLint, type check via tsc.
- **Cost ceiling:** synthetic.new $60/mo flat, plus Supabase Pro ($25/mo for pg_cron + pgvector at scale), plus Vercel (free tier covers current traffic). Pro subscription revenue offsets at >10 paying users.
- **Time budget:** 3 weeks calendar time, 2-3 hours/day from JR plus autonomous cron iterations overnight (when re-enabled).

## Stripe Pro Subscription — Required Secrets

Set these in Supabase Secrets (Dashboard → Settings → Secrets) before the Tag Pro flow works end-to-end. Do NOT commit these values.

| Secret name | Where to get it | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | `sk_live_...` in prod, `sk_test_...` in dev |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → add endpoint for `tag-pro-webhook` | `whsec_...` — one secret per webhook endpoint |
| `STRIPE_TAG_PRO_PRICE_ID` | Stripe Dashboard → Products → create "Tag Pro" at $7/mo recurring | `price_...` — copy after creating the Price |
| `SITE_URL` | `https://hecz.dev` in prod | Used for Stripe success/cancel redirect URLs |

**Stripe webhook endpoint URL** (register in Stripe Dashboard):
`https://gbuzohuntmqqtoipavdr.supabase.co/functions/v1/tag-pro-webhook`

**Events to enable on the webhook:**
- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

## Open questions / followups (post-v1)

- Whether to register a standalone `tag.so` / `tag.dev` domain (currently `hecz.dev/chat`)
- Image input support (Kimi-K2.6 supports it — easy add)
- Multi-turn agent loops (could differentiate from T3)
- Promote to `chat.hecz.dev` subdomain once chat has >100 DAU (Vercel single-line config)
- Open source the OS mirror sync GitHub Action as a separate template repo
