import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  errorResponse,
  jsonResponse,
  optionsResponse,
  readJson,
} from "../_shared/http.ts";

// ---------------------------------------------------------------------------
// mem0-search — semantic search over the authenticated user's memories
//
// POST body: { query: string, limit?: number, min_similarity?: number }
// Returns:   { memories: [{ id, content, importance, similarity, created_at }] }
//
// Requires: Authorization: Bearer <supabase-jwt>
// ---------------------------------------------------------------------------

const SYNTHETIC_API_KEY = Deno.env.get("SYNTHETIC_API_KEY");
const SYNTHETIC_BASE_URL =
  Deno.env.get("SYNTHETIC_BASE_URL") ?? "https://api.synthetic.new/v1";

const EMBEDDING_MODEL = "hf:openai/text-embedding-3-small"; // 1536-dim

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Resolve the authenticated user_id from the Supabase JWT in Authorization header. */
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;

  const token = authHeader.slice("bearer ".length).trim();
  if (!token || token === SUPABASE_ANON_KEY) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/** Call synthetic.new /v1/embeddings and return the vector. */
async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${SYNTHETIC_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SYNTHETIC_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`synthetic.new embeddings error (${res.status}): ${detail}`);
  }

  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("synthetic.new returned no embedding vector");
  }
  return embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return errorResponse({ error: "POST required" }, 405);
  const reqStart = Date.now();

  // Guard: synthetic.new must be configured
  if (!SYNTHETIC_API_KEY) {
    return errorResponse(
      {
        error: "synthetic.new not configured",
        hint: "Set SYNTHETIC_API_KEY in Supabase project secrets dashboard",
      },
      503,
    );
  }

  // Auth: extract user_id from Supabase JWT
  const userId = await getUserId(req);
  if (!userId) {
    return errorResponse({ error: "unauthorized — valid Supabase JWT required" }, 401);
  }

  let body: { query: string; limit?: number; min_similarity?: number };
  try {
    body = await readJson<typeof body>(req);
  } catch (err) {
    return errorResponse({ error: err instanceof Error ? err.message : "invalid body" }, 400);
  }

  const { query, limit = 5, min_similarity = 0.7 } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return errorResponse({ error: "query is required and must be a non-empty string" }, 400);
  }

  // Embed query via synthetic.new
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query.trim());
  } catch (err) {
    console.error("mem0-search: embedding failed:", err instanceof Error ? err.message : err);
    console.log(JSON.stringify({ route: "mem0-search", total_latency_ms: Date.now() - reqStart, status: "upstream_error", user_id: userId }));
    return errorResponse({ error: "embedding failed", detail: err instanceof Error ? err.message : "unknown" }, 502);
  }

  // Call match_chat_memories RPC via service role client
  // TODO: remove `as any` cast when Supabase types are regenerated to include match_chat_memories RPC
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await (serviceClient.rpc as any)(
    "match_chat_memories",
    {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_match_count: limit,
      p_min_similarity: min_similarity,
    },
  );

  if (error) {
    console.error("mem0-search: RPC failed:", error.message);
    console.log(JSON.stringify({ route: "mem0-search", total_latency_ms: Date.now() - reqStart, status: "upstream_error", user_id: userId }));
    return errorResponse({ error: "memory search failed", detail: error.message }, 500);
  }

  // TODO: remove `as any` cast when Supabase types include match_chat_memories return type
  const memories = ((data as any[]) ?? []).map((row: any) => ({
    id: row.id,
    content: row.content,
    importance: row.importance,
    similarity: row.similarity,
    created_at: row.created_at,
  }));

  console.log(JSON.stringify({ route: "mem0-search", total_latency_ms: Date.now() - reqStart, status: "ok", user_id: userId, results: memories.length }));
  return jsonResponse({ memories });
});
