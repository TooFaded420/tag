-- =============================================================================
-- chat_memories: Mem0 self-hosted vector memory store for Tag
-- Stores per-user semantic memories with OpenAI-compatible 1536-dim embeddings.
-- =============================================================================

-- pgvector extension (not yet enabled in this project)
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_memories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  embedding   vector(1536) NOT NULL,
  importance  real        NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================
-- IVFFlat cosine index for ANN similarity search (universally supported on Supabase pg17)
CREATE INDEX IF NOT EXISTS chat_memories_embedding_idx
  ON public.chat_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Btree index for efficient per-user chronological queries
CREATE INDEX IF NOT EXISTS chat_memories_user_created_idx
  ON public.chat_memories (user_id, created_at DESC);

-- =============================================================================
-- updated_at trigger (uses existing project helper update_updated_at_column)
-- =============================================================================
CREATE OR REPLACE TRIGGER set_chat_memories_updated_at
  BEFORE UPDATE ON public.chat_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE public.chat_memories ENABLE ROW LEVEL SECURITY;

-- Users can select their own memories; owners see all
CREATE POLICY "chat_memories_select_own"
  ON public.chat_memories FOR SELECT
  USING (auth.uid() = user_id OR public.is_owner(auth.uid()));

-- Users can insert their own memories
CREATE POLICY "chat_memories_insert_own"
  ON public.chat_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memories; owners can update all
CREATE POLICY "chat_memories_update_own"
  ON public.chat_memories FOR UPDATE
  USING (auth.uid() = user_id OR public.is_owner(auth.uid()));

-- Users can delete their own memories; owners can delete all
CREATE POLICY "chat_memories_delete_own"
  ON public.chat_memories FOR DELETE
  USING (auth.uid() = user_id OR public.is_owner(auth.uid()));

-- =============================================================================
-- RPC: match_chat_memories
-- Cosine similarity search for a given user's memories.
-- similarity = 1 - cosine_distance = 1 - (embedding <=> query)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.match_chat_memories(
  p_user_id        uuid,
  p_query_embedding vector(1536),
  p_match_count    int,
  p_min_similarity real
)
RETURNS TABLE (
  id          uuid,
  content     text,
  importance  real,
  similarity  real,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.id,
    cm.content,
    cm.importance,
    (1 - (cm.embedding <=> p_query_embedding))::real AS similarity,
    cm.created_at
  FROM public.chat_memories cm
  WHERE cm.user_id = p_user_id
    AND (1 - (cm.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY cm.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chat_memories(uuid, vector(1536), int, real) TO authenticated;
