-- =============================================================================
-- Migration 00006: Support — support_tickets
-- =============================================================================
-- Customer support system with AI-first triage. Tickets contain a full
-- conversation history as a JSONB array of {role, content, timestamp} messages.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: support_tickets
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  subject     text        not null,
  messages    jsonb       not null default '[]',
  status      text        not null default 'open'
                          check (status in ('open', 'ai_handled', 'escalated', 'resolved')),
  priority    text        not null default 'medium'
                          check (priority in ('low', 'medium', 'high')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table  public.support_tickets is 'Customer support tickets with AI-first triage and full conversation history.';
comment on column public.support_tickets.messages is 'JSONB array of {role, content, timestamp} representing the full conversation.';
comment on column public.support_tickets.status is 'Ticket lifecycle: open -> ai_handled | escalated -> resolved.';

-- Indexes
create index idx_support_tickets_user_id on public.support_tickets (user_id);
create index idx_support_tickets_status  on public.support_tickets (status);

-- RLS
alter table public.support_tickets enable row level security;

-- Users can read their own tickets
create policy "Users can read own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

-- Users can create their own tickets
create policy "Users can create own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

-- Admin can read all tickets
create policy "Admin can read all tickets"
  on public.support_tickets for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can update all tickets (status changes, adding responses, etc.)
create policy "Admin can update all tickets"
  on public.support_tickets for update
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

-- Service role full access (webhooks, edge functions, AI agent operations)
create policy "Service role full access on support_tickets"
  on public.support_tickets for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
