-- =============================================================================
-- Migration 00017: Agent Memory & Collaboration System
-- =============================================================================
-- Adds pgvector-powered persistent memory for AI agents, enabling:
--   1. Per-customer memories — agents remember individual customers
--   2. Business-wide learnings — insights all agents can access
--   3. Agent-private memories — individual agent learnings
--   4. Conversation memories — key takeaways surfaced on return visits
--   5. Agent handoffs — context transfer between agents
--
-- Dependencies:
--   - pgvector extension (available on all Supabase plans)
--   - pg_net extension (enabled in migration 00013)
--   - is_admin() function (created in migration 00015)
--
-- Configuration required for pg_net trigger:
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
--   (Auto-configured locally by Supabase CLI; must be set manually on hosted.)
--
-- SECURITY NOTE: The service_role_key stored in app.settings is readable
-- by any database role with access to current_setting(). On Supabase hosted,
-- only the service role and dashboard have this access. On self-hosted setups,
-- ensure database users are restricted appropriately. The queue_memory_embedding
-- trigger uses SECURITY DEFINER to read this setting on behalf of row-level callers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extension: pgvector
-- ---------------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Table: agent_memories
-- ---------------------------------------------------------------------------
create table public.agent_memories (
  id                     uuid        primary key default gen_random_uuid(),
  agent_id               uuid        not null references public.agents(id) on delete cascade,
  scope                  text        not null check (scope in ('customer', 'business', 'agent', 'conversation')),
  customer_id            uuid        references public.profiles(id) on delete cascade,
  content                text        not null,
  embedding              extensions.halfvec(384),
  category               text        not null default 'general',
  importance             smallint    not null default 5 check (importance between 1 and 10),
  source_conversation_id uuid        references public.agent_conversations(id) on delete set null,
  metadata               jsonb       not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Ensure customer-scoped memories always have a customer_id
  constraint chk_customer_scope_has_customer check (scope <> 'customer' or customer_id is not null)
);

comment on table  public.agent_memories is 'Persistent memories created by AI agents — enables cross-conversation learning, customer context, and shared knowledge.';
comment on column public.agent_memories.scope is 'Memory visibility: customer (per-person), business (shared), agent (private), conversation (thread-scoped).';
comment on column public.agent_memories.embedding is 'halfvec(384) embedding from gte-small model — null until Edge Function processes it asynchronously.';
comment on column public.agent_memories.category is 'Freeform domain category: preference, insight, behavior, feedback, strategy, outcome, product, campaign, audience, process, general.';
comment on column public.agent_memories.importance is 'Agent-assigned priority 1-10 (10 = critical business insight, 1 = minor observation).';
comment on column public.agent_memories.metadata is 'Flexible extra context stored as JSONB.';

-- ---------------------------------------------------------------------------
-- Table: agent_handoffs
-- ---------------------------------------------------------------------------
create table public.agent_handoffs (
  id               uuid        primary key default gen_random_uuid(),
  source_agent_id  uuid        not null references public.agents(id) on delete cascade,
  target_agent_id  uuid        not null references public.agents(id) on delete cascade,
  customer_id      uuid        references public.profiles(id) on delete cascade,
  summary          text        not null,
  memory_ids       jsonb       not null default '[]',
  status           text        not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'expired')),
  metadata         jsonb       not null default '{}',
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);

comment on table  public.agent_handoffs is 'Inter-agent context transfers — when one agent hands off a task to another with relevant context.';
comment on column public.agent_handoffs.memory_ids is 'JSONB array of agent_memories UUIDs relevant to this handoff.';
comment on column public.agent_handoffs.metadata is 'Flexible extra context stored as JSONB.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_agent_memories_agent_id   on public.agent_memories (agent_id);
create index idx_agent_memories_scope      on public.agent_memories (scope);
create index idx_agent_memories_customer   on public.agent_memories (agent_id, customer_id) where customer_id is not null;
create index idx_agent_memories_embedding  on public.agent_memories using hnsw (embedding halfvec_cosine_ops);

create index idx_agent_handoffs_target on public.agent_handoffs (target_agent_id, status);
create index idx_agent_handoffs_source on public.agent_handoffs (source_agent_id);

-- ---------------------------------------------------------------------------
-- RLS: agent_memories
-- ---------------------------------------------------------------------------
alter table public.agent_memories enable row level security;

create policy "Admin full access on agent_memories"
  on public.agent_memories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Service role full access on agent_memories"
  on public.agent_memories for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- RLS: agent_handoffs
-- ---------------------------------------------------------------------------
alter table public.agent_handoffs enable row level security;

create policy "Admin full access on agent_handoffs"
  on public.agent_handoffs for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Service role full access on agent_handoffs"
  on public.agent_handoffs for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Function: match_memories (semantic similarity search)
-- ---------------------------------------------------------------------------
-- SECURITY NOTE: This function is intentionally NOT SECURITY DEFINER.
-- It runs with the caller's permissions and relies on RLS policies above.
-- All application callers use createAdminClient() (service role), which
-- passes the service_role RLS policy. Non-admin PostgREST callers are
-- blocked by the admin-only RLS policy on agent_memories.
-- ---------------------------------------------------------------------------
create or replace function match_memories(
  query_embedding extensions.halfvec(384),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_agent_id uuid default null,
  filter_scope text default null,
  filter_customer_id uuid default null,
  filter_conversation_id uuid default null
)
returns table (
  id uuid,
  agent_id uuid,
  scope text,
  customer_id uuid,
  content text,
  category text,
  importance smallint,
  source_conversation_id uuid,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    m.id, m.agent_id, m.scope, m.customer_id,
    m.content, m.category, m.importance, m.source_conversation_id,
    m.metadata,
    1 - (m.embedding <=> query_embedding) as similarity
  from agent_memories m
  where m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) > match_threshold
    and (filter_agent_id is null or m.agent_id = filter_agent_id)
    and (filter_scope is null or m.scope = filter_scope)
    and (filter_customer_id is null or m.customer_id = filter_customer_id)
    and (filter_conversation_id is null or m.source_conversation_id = filter_conversation_id)
  order by m.embedding <=> query_embedding asc
  limit least(match_count, 50);
$$;

-- ---------------------------------------------------------------------------
-- Trigger: auto-update updated_at on agent_memories
-- ---------------------------------------------------------------------------
create trigger set_agent_memories_updated_at
  before update on public.agent_memories
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: queue embedding generation via pg_net → Edge Function
-- ---------------------------------------------------------------------------
create or replace function public.queue_memory_embedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/embed-memory',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('id', NEW.id, 'content', NEW.content)
  );
  return NEW;
end;
$$;

create trigger embed_memory_on_insert
  after insert on public.agent_memories
  for each row
  execute function public.queue_memory_embedding();

create trigger embed_memory_on_content_update
  after update of content on public.agent_memories
  for each row
  when (NEW.content is distinct from OLD.content)
  execute function public.queue_memory_embedding();
