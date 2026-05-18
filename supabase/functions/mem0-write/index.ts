import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  errorResponse,
  jsonResponse,
  optionsResponse,
  readJson,
} from "../_shared/http.ts";
import { logRequest } from "../_shared/log.ts";

// ---------------------------------------------------------------------------
// mem0-write — persist a memory entry for the authenticated user
//
// POST body: { content: string, importance?: number, metadata?: object }
// Returns:   { id: string, created_at: string }
//
// Requires: Authorization: Bearer <supabase-jwt>
// ---------------------------------------------------------------------------

const SYNTHETIC_API_KEY = Deno.env.get("SYNTHETIC_API_KEY");
const SYNTHETIC_BASE_URL =
  Deno.env.get("SYNTHETIC_BASE_URL") ?? "https://api.synthetic.new/v1";

// synthetic.new dropped openai embeddings — swap to nomic-embed-text-v1.5
// (768-dim, open-source). chat_memories.embedding column matches via migration
// 20260518010000_chat_memories_nomic_768.sql.
const EMBEDDING_MODEL = "hf:nomic-ai/nomic-embed-text-v1.5"; // 768-dim

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
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return errorResponse({ error: "POST required" }, 405, req);
  const reqStart = Date.now();

  // Guard: synthetic.new must be configured
  if (!SYNTHETIC_API_KEY) {
    return errorResponse(
      {
        error: "synthetic.new not configured",
        hint: "Set SYNTHETIC_API_KEY in Supabase project secrets dashboard",
      },
      503,
      req,
    );
  }

  // Auth: extract user_id from Supabase JWT
  const userId = await getUserId(req);
  if (!userId) {
    return errorResponse({ error: "unauthorized — valid Supabase JWT required" }, 401, req);
  }

  let body: { content: string; importance?: number; metadata?: Record<string, unknown>; workspace_id?: string };
  try {
    body = await readJson<typeof body>(req);
  } catch (err) {
    return errorResponse({ error: err instanceof Error ? err.message : "invalid body" }, 400, req);
  }

  const { content, importance = 0.5, metadata = {}, workspace_id } = body;
  const imp = Math.min(1, Math.max(0, Number(importance) || 0.5));

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return errorResponse({ error: "content is required and must be a non-empty string" }, 400, req);
  }

  // Embed content via synthetic.new
  let embedding: number[];
  try {
    embedding = await embedText(content.trim());
  } catch (err) {
    console.error("mem0-write: embedding failed:", err instanceof Error ? err.message : err);
    logRequest({ route: "mem0-write", status: "upstream_error", start: reqStart, user_id: userId });
    return errorResponse({ error: "failed to write memory" }, 502, req);
  }

  // Insert into chat_memories via service role client
  // TODO: remove `as any` cast when Supabase types are regenerated to include chat_memories
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Build insert row; include workspace_id when provided for workspace-scoped memories.
  // Omitting workspace_id (undefined) keeps the column NULL = personal mode (existing behavior).
  // TODO: remove `as any` cast when Supabase types are regenerated to include workspace_id
  const insertRow: Record<string, unknown> = {
    user_id: userId,
    content: content.trim(),
    embedding,
    importance: imp,
    metadata,
  };
  if (workspace_id) {
    insertRow.workspace_id = workspace_id;
  }

  const { data, error } = await (serviceClient
    .from("chat_memories") as any)
    .insert(insertRow)
    .select("id, created_at")
    .single();

  if (error) {
    console.error("mem0-write: insert failed:", error.message);
    logRequest({ route: "mem0-write", status: "upstream_error", start: reqStart, user_id: userId });
    return errorResponse({ error: "failed to write memory" }, 500, req);
  }

  logRequest({ route: "mem0-write", status: "ok", start: reqStart, user_id: userId });
  return jsonResponse({ id: (data as any).id, created_at: (data as any).created_at }, undefined, req);
});
