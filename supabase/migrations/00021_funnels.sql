-- =============================================================================
-- Migration 00021: Funnels — Orchestration & Measurement Layer
-- =============================================================================
-- Adds funnel containers that group custom pages into conversion-focused
-- sequences with event tracking for views, conversions, and drop-off analysis.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Funnels table — organizational container for page sequences
-- ---------------------------------------------------------------------------
create table public.funnels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  goal_type text not null
    check (goal_type in ('lead_capture', 'direct_sale', 'lead_to_sale', 'upsell')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Funnel steps — ordered page references within a funnel
-- ---------------------------------------------------------------------------
create table public.funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  page_id uuid not null references public.pages(id),
  step_order integer not null,
  step_type text not null
    check (step_type in ('landing', 'thank_you', 'sales', 'upsell', 'content')),
  expected_action text not null
    check (expected_action in ('opt_in', 'purchase', 'view', 'click_through')),
  product_id uuid references public.products(id),
  email_sequence_id uuid references public.email_sequences(id),
  created_at timestamptz not null default now(),
  unique (funnel_id, step_order),
  unique (funnel_id, page_id)
);

-- ---------------------------------------------------------------------------
-- 3. Funnel events — view and conversion tracking per step
-- ---------------------------------------------------------------------------
create table public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  funnel_step_id uuid not null references public.funnel_steps(id) on delete cascade,
  event_type text not null
    check (event_type in ('view', 'conversion')),
  visitor_hash text,
  lead_id uuid references public.leads(id),
  user_id uuid references auth.users(id),
  stripe_session_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_funnel_events_funnel_time on public.funnel_events (funnel_id, created_at);
create index idx_funnel_events_step_type on public.funnel_events (funnel_step_id, event_type);
create index idx_funnel_events_visitor on public.funnel_events (visitor_hash);

-- Dedup: prevent duplicate Stripe-based conversion events per step
create unique index idx_funnel_events_stripe_dedup
  on public.funnel_events (funnel_step_id, stripe_session_id)
  where stripe_session_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Extend pages table — container assignment columns
-- ---------------------------------------------------------------------------
alter table public.pages
  add column container_type text not null default 'standalone'
    check (container_type in ('standalone', 'website', 'funnel'));

alter table public.pages
  add column funnel_id uuid references public.funnels(id) on delete set null;

-- CHECK: if container_type is 'funnel' then funnel_id must be set
alter table public.pages
  add constraint pages_funnel_id_required
    check (container_type != 'funnel' or funnel_id is not null);

-- Trigger: reset container_type to 'standalone' before funnel deletion
-- so that ON DELETE SET NULL on funnel_id doesn't violate the CHECK constraint
create or replace function public.reset_page_container_on_funnel_delete()
returns trigger
language plpgsql
as $$
begin
  update public.pages
  set container_type = 'standalone'
  where funnel_id = OLD.id and container_type = 'funnel';
  return OLD;
end;
$$;

create trigger trg_reset_page_container_before_funnel_delete
  before delete on public.funnels
  for each row
  execute function public.reset_page_container_on_funnel_delete();

-- ---------------------------------------------------------------------------
-- 5. RLS policies
-- ---------------------------------------------------------------------------

-- Funnels
alter table public.funnels enable row level security;

create policy "Admin full access to funnels"
  on public.funnels for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authenticated read active funnels"
  on public.funnels for select
  using (
    auth.uid() is not null and status = 'active'
  );

-- Funnel steps
alter table public.funnel_steps enable row level security;

create policy "Admin full access to funnel_steps"
  on public.funnel_steps for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authenticated read funnel_steps for active funnels"
  on public.funnel_steps for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.funnels where id = funnel_id and status = 'active'
    )
  );

-- Funnel events
alter table public.funnel_events enable row level security;

create policy "Admin full access to funnel_events"
  on public.funnel_events for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Authenticated read own funnel_events"
  on public.funnel_events for select
  using (
    auth.uid() is not null and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 6. Grant funnel tools to the Dev Agent
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.agents where slug = 'dev-agent') then
    update public.agents
    set tools = array_cat(tools, ARRAY[
      'create_funnel',
      'update_funnel',
      'get_funnel_stats',
      'list_funnels'
    ])
    where slug = 'dev-agent'
      and not tools @> ARRAY['create_funnel'];
  end if;
end $$;
