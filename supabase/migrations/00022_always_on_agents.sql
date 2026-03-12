-- =============================================================================
-- Migration 00022: Always-On Agent Infrastructure
-- =============================================================================
-- Creates 6 tables for persistent agent execution:
--   1. agent_schedules  — cron-like scheduled agent runs
--   2. agent_triggers   — event-driven agent triggers (Supabase Realtime)
--   3. agent_runs       — audit log of all autonomous agent executions
--   4. agent_status     — real-time per-agent status for dashboard
--   5. goals            — user-defined business goals for autonomous pursuit
--   6. goal_tasks       — decomposed tasks within a goal
-- Scheduling handled by worker process (replaces pg_cron from migration 00013).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: agent_schedules
-- ---------------------------------------------------------------------------
create table public.agent_schedules (
  id              uuid        primary key default gen_random_uuid(),
  agent_id        uuid        not null references public.agents(id) on delete cascade,
  name            text        not null,
  prompt          text        not null,
  cron_expression text        not null,
  is_active       boolean     not null default false,
  last_run_at     timestamptz,
  next_run_at     timestamptz,
  max_retries     int         not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.agent_schedules is 'Cron-like scheduled agent runs, managed by the worker process.';

-- Indexes
create index idx_agent_schedules_next_run on public.agent_schedules (is_active, next_run_at);

-- RLS
alter table public.agent_schedules enable row level security;

create policy "Admin full access on agent_schedules"
  on public.agent_schedules for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Service role full access on agent_schedules"
  on public.agent_schedules for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: agent_triggers
-- ---------------------------------------------------------------------------
create table public.agent_triggers (
  id                uuid        primary key default gen_random_uuid(),
  agent_id          uuid        not null references public.agents(id) on delete cascade,
  name              text        not null,
  table_name        text        not null,
  event_type        text        not null default 'INSERT',
  filter_conditions jsonb,
  prompt_template   text        not null,
  is_active         boolean     not null default false,
  cooldown_seconds  int         not null default 60,
  last_triggered_at timestamptz,
  created_at        timestamptz not null default now()
);

comment on table public.agent_triggers is 'Event-driven agent triggers via Supabase Realtime postgres_changes.';

-- Indexes
create index idx_agent_triggers_active on public.agent_triggers (is_active, table_name);

-- RLS
alter table public.agent_triggers enable row level security;

create policy "Admin full access on agent_triggers"
  on public.agent_triggers for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Service role full access on agent_triggers"
  on public.agent_triggers for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: agent_runs
-- ---------------------------------------------------------------------------
create table public.agent_runs (
  id            uuid        primary key default gen_random_uuid(),
  agent_id      uuid        not null references public.agents(id) on delete cascade,
  trigger_type  text        not null check (trigger_type in ('schedule', 'event', 'goal', 'manual')),
  trigger_id    uuid,
  status        text        not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  prompt        text,
  response      text,
  tool_calls    jsonb,
  tokens_used   int,
  duration_ms   int,
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.agent_runs is 'Audit log of all autonomous agent executions by the worker.';

-- Indexes
create index idx_agent_runs_agent_created on public.agent_runs (agent_id, created_at desc);
create index idx_agent_runs_status on public.agent_runs (status);

-- RLS
alter table public.agent_runs enable row level security;

create policy "Admin full access on agent_runs"
  on public.agent_runs for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Service role full access on agent_runs"
  on public.agent_runs for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: agent_status
-- ---------------------------------------------------------------------------
create table public.agent_status (
  agent_id      uuid        primary key,
  status        text        not null default 'disabled' check (status in ('idle', 'running', 'error', 'disabled')),
  current_task  text,
  last_active_at timestamptz,
  runs_today    int         not null default 0,
  errors_today  int         not null default 0,
  updated_at    timestamptz not null default now()
);

comment on table public.agent_status is 'Real-time per-agent worker status for the command center dashboard.';
comment on column public.agent_status.agent_id is 'References agents(id). The sentinel row 00000000-0000-0000-0000-000000000000 tracks worker heartbeat.';

-- RLS
alter table public.agent_status enable row level security;

create policy "Admin full access on agent_status"
  on public.agent_status for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Service role full access on agent_status"
  on public.agent_status for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Protect the heartbeat sentinel from deletion
create policy "protect_heartbeat_sentinel"
  on public.agent_status for delete
  using (agent_id != '00000000-0000-0000-0000-000000000000');

-- ---------------------------------------------------------------------------
-- Table: goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id              uuid        primary key default gen_random_uuid(),
  title           text        not null,
  description     text,
  target_metrics  jsonb,
  current_metrics jsonb,
  strategy        text,
  status          text        not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'abandoned')),
  target_date     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.goals is 'User-defined business goals for autonomous multi-day pursuit by agents.';

-- Indexes
create index idx_goals_status on public.goals (status);

-- RLS
alter table public.goals enable row level security;

create policy "Admin full access on goals"
  on public.goals for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Service role full access on goals"
  on public.goals for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: goal_tasks
-- ---------------------------------------------------------------------------
create table public.goal_tasks (
  id           uuid        primary key default gen_random_uuid(),
  goal_id      uuid        not null references public.goals(id) on delete cascade,
  agent_id     uuid        references public.agents(id) on delete set null,
  title        text        not null,
  description  text,
  status       text        not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  result       text,
  priority     int         not null default 5,
  order_index  int         not null default 0,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.goal_tasks is 'Decomposed actionable tasks within a goal, assigned to specific agents.';

-- Indexes
create index idx_goal_tasks_goal on public.goal_tasks (goal_id, order_index);

-- RLS
alter table public.goal_tasks enable row level security;

create policy "Admin full access on goal_tasks"
  on public.goal_tasks for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Service role full access on goal_tasks"
  on public.goal_tasks for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Enable Realtime for dashboard subscriptions
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.agent_status;
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.goals;
alter publication supabase_realtime add table public.goal_tasks;

-- ---------------------------------------------------------------------------
-- Seed: Worker heartbeat sentinel
-- ---------------------------------------------------------------------------
-- The sentinel UUID does not reference the agents table (agent_status has no FK).
insert into public.agent_status (agent_id, status, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'disabled', now());

-- ---------------------------------------------------------------------------
-- Seed: agent_status rows for existing agents
-- ---------------------------------------------------------------------------
insert into public.agent_status (agent_id, status)
select id, 'disabled' from public.agents
on conflict (agent_id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: Default schedules (inactive) matching former pg_cron jobs
-- ---------------------------------------------------------------------------
-- These reference agents by slug. Use a subquery to resolve agent IDs.
-- If agents don't exist yet, these inserts are skipped via the WHERE clause.
insert into public.agent_schedules (agent_id, name, prompt, cron_expression, is_active, next_run_at)
select id, 'process-email-queue', 'Process the email sequence queue. Check for due enrollments and send their next email step.', '*/5 * * * *', false, now()
from public.agents where slug = 'dev-agent'
limit 1;

insert into public.agent_schedules (agent_id, name, prompt, cron_expression, is_active, next_run_at)
select id, 'process-content-queue', 'Publish approved social content from the content queue via Buffer.', '*/10 * * * *', false, now()
from public.agents where slug = 'content-director'
limit 1;

insert into public.agent_schedules (agent_id, name, prompt, cron_expression, is_active, next_run_at)
select id, 'daily-engagement-check', 'Run daily engagement health check. Flag cold leads, stalled students, expiring subscriptions, and send testimonial requests.', '0 9 * * *', false, now()
from public.agents where slug = 'customer-success'
limit 1;

insert into public.agent_schedules (agent_id, name, prompt, cron_expression, is_active, next_run_at)
select id, 'weekly-ceo-briefing', 'Generate weekly CEO business briefing with metrics summary and recommendations.', '0 9 * * 1', false, now()
from public.agents where slug = 'dev-agent'
limit 1;

insert into public.agent_schedules (agent_id, name, prompt, cron_expression, is_active, next_run_at)
select id, 'stripe-sync', 'Sync products and subscriptions from Stripe to keep local data current.', '0 */6 * * *', false, now()
from public.agents where slug = 'dev-agent'
limit 1;
