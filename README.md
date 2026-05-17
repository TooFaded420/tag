# Tag — Open Source Multi-Model AI Chat

**Tag** is the chat product inside [Hecz](https://hecz.dev) — a free + Pro multi-model AI chat with persistent memory, BYOK support, and streaming responses.

Hosted version: **[hecz.dev/chat](https://hecz.dev/chat)**

---

## Features

- **Multi-model routing** — Claude, GPT-4o, Gemini, and more via a single interface
- **Persistent memory** — conversations remembered across sessions via pgvector + mem0
- **Free + Pro tiers** — generous free limits, Pro unlocks higher rate limits and priority routing
- **BYOK (Bring Your Own Key)** — use your own API keys for any provider
- **Streaming responses** — real-time token streaming via Supabase Edge Functions
- **Graffiti aesthetic** — Tag's signature animated logo and Editorial Street design

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + Tailwind 4 + Radix UI |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL with pgvector |
| Memory | mem0 + pgvector for semantic recall |
| Auth | Supabase Auth |
| AI routing | `synthetic-public-proxy` Edge Function |

---

## Self-Hosting

> Requires: Supabase project, a [synthetic.new](https://synthetic.new) API key (or BYOK provider keys), and Node 22 + pnpm.

1. Clone this repo.
2. Create a Supabase project and run the migrations in `supabase/migrations/` in order.
3. Deploy the Edge Functions in `supabase/functions/` via `supabase functions deploy`.
4. Set environment variables (see `.env.example` in the main Hecz repo).
5. Run `pnpm dev` for local development.

The `synthetic-public-proxy` function handles model routing — you'll need either a `synthetic.new` key or configure direct provider keys in Supabase Vault.

---

## License

MIT — see [LICENSE](./LICENSE).

Copyright 2026 JR Lopez. The hosted service at [hecz.dev/chat](https://hecz.dev/chat) is operated separately and not included in this license.

---

*This repository is auto-synced from the private Hecz monorepo on every push to `main`.*
