-- Daily quota tracking for Tag chat product
-- Tracks msg_count (cheap models) and premium_msg_count (Pro premium models)
-- per user or per IP hash (SHA-256). Writes only via increment_chat_usage() RPC.

create table if not exists chat_usage (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        references auth.users(id) on delete cascade,
  ip_hash             text,
  day                 date        not null default current_date,
  msg_count           int         not null default 0,
  premium_msg_count   int         not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One row per (user_id, day) — NULL user_id rows treated as distinct per user
  constraint chat_usage_user_day_unique unique nulls not distinct (user_id, day),
  -- One row per (ip_hash, day) — NULL ip_hash rows treated as distinct per IP
  constraint chat_usage_ip_day_unique   unique nulls not distinct (ip_hash, day),
  -- At least one identity must be present
  constraint chat_usage_identity_check  check (user_id is not null or ip_hash is not null)
);

-- Indexes for lookup and cleanup
create index if not exists idx_chat_usage_user_day
  on chat_usage(user_id, day)
  where user_id is not null;

create index if not exists idx_chat_usage_ip_day
  on chat_usage(ip_hash, day)
  where ip_hash is not null;

-- Plain btree on day; cleanup_old_chat_usage() does an indexed range scan.
-- (originally had a partial WHERE clause using current_date which Postgres
-- rejected as non-IMMUTABLE in index predicates.)
create index if not exists idx_chat_usage_cleanup
  on chat_usage(day);

-- RLS: no direct client writes; reads scoped to own row only
alter table chat_usage enable row level security;

-- Signed-in user reads their own row
create policy "user reads own chat_usage"
  on chat_usage for select
  using (auth.uid() = user_id);

-- Anon/any caller reads by ip_hash via request header setting
create policy "anon reads own chat_usage by ip_hash"
  on chat_usage for select
  using (ip_hash = current_setting('request.ip_hash', true));

-- Owner admin override (matches existing codebase is_owner pattern)
create policy "owner reads all chat_usage"
  on chat_usage for select
  using (public.is_owner(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- increment_chat_usage: atomic upsert for daily message count
-- Uses two separate upsert statements because ON CONFLICT ... WHERE (partial
-- index predicate) requires the conflict target to match one constraint at a
-- time. We try the user-based path first, then fall back to the ip-based path
-- for anonymous callers.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.increment_chat_usage(
  p_user_id   uuid,
  p_ip_hash   text,
  p_is_premium boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row chat_usage;
begin
  -- Path 1: signed-in user (user_id is the conflict key)
  if p_user_id is not null then
    insert into chat_usage (user_id, ip_hash, day, msg_count, premium_msg_count)
    values (
      p_user_id,
      p_ip_hash,
      current_date,
      case when p_is_premium then 0 else 1 end,
      case when p_is_premium then 1 else 0 end
    )
    on conflict (user_id, day) do update set
      msg_count         = chat_usage.msg_count         + (case when p_is_premium then 0 else 1 end),
      premium_msg_count = chat_usage.premium_msg_count + (case when p_is_premium then 1 else 0 end),
      updated_at        = now()
    returning * into v_row;

    return jsonb_build_object(
      'msg_count',         v_row.msg_count,
      'premium_msg_count', v_row.premium_msg_count,
      'day',               v_row.day
    );
  end if;

  -- Path 2: anonymous caller — ip_hash is the conflict key
  if p_ip_hash is not null then
    insert into chat_usage (ip_hash, day, msg_count, premium_msg_count)
    values (
      p_ip_hash,
      current_date,
      case when p_is_premium then 0 else 1 end,
      case when p_is_premium then 1 else 0 end
    )
    on conflict (ip_hash, day) do update set
      msg_count         = chat_usage.msg_count         + (case when p_is_premium then 0 else 1 end),
      premium_msg_count = chat_usage.premium_msg_count + (case when p_is_premium then 1 else 0 end),
      updated_at        = now()
    returning * into v_row;

    return jsonb_build_object(
      'msg_count',         v_row.msg_count,
      'premium_msg_count', v_row.premium_msg_count,
      'day',               v_row.day
    );
  end if;

  -- Neither path matched — both inputs are null (violates check constraint anyway)
  raise exception 'increment_chat_usage: p_user_id and p_ip_hash cannot both be null';
end;
$$;

grant execute on function public.increment_chat_usage(uuid, text, boolean) to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- cleanup_old_chat_usage: delete rows older than 30 days (called by cron)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cleanup_old_chat_usage()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from chat_usage where day < current_date - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_old_chat_usage() to authenticated;
