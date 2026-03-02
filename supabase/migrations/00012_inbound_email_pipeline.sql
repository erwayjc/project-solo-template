-- =============================================================================
-- Migration 00012: Inbound Email Pipeline
-- =============================================================================
-- Adds inbound email tracking for CS agent automation, extends support_tickets
-- to support email-originated tickets, and adds CS agent config to site_config.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: inbound_emails
-- Tracks every inbound email received via Resend webhook for CS analytics.
-- ---------------------------------------------------------------------------
create table public.inbound_emails (
  id                    uuid        primary key default gen_random_uuid(),
  resend_email_id       text        unique,
  from_address          text        not null,
  from_name             text,
  to_address            text        not null,
  subject               text,
  body_snippet          text,
  support_ticket_id     uuid        references public.support_tickets(id),
  agent_response_status text        not null default 'pending'
                                    check (agent_response_status in ('pending', 'processed', 'escalated', 'failed')),
  created_at            timestamptz not null default now(),
  processed_at          timestamptz
);

comment on table  public.inbound_emails is 'Inbound email log for CS analytics. Each row is a received email from Resend webhook.';
comment on column public.inbound_emails.body_snippet is 'First 500 characters of the email body for preview/analytics.';
comment on column public.inbound_emails.agent_response_status is 'Processing lifecycle: pending -> processed | escalated | failed.';

-- Indexes
create index idx_inbound_emails_from_address on public.inbound_emails (from_address);
create index idx_inbound_emails_status       on public.inbound_emails (agent_response_status);
create index idx_inbound_emails_created_at   on public.inbound_emails (created_at);

-- RLS
alter table public.inbound_emails enable row level security;

-- Service role full access (webhooks, agent operations)
create policy "Service role full access on inbound_emails"
  on public.inbound_emails for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Admin read access
create policy "Admin can read inbound_emails"
  on public.inbound_emails for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- ALTER support_tickets: add source, customer_email, make user_id nullable
-- ---------------------------------------------------------------------------

-- Add source column to track where the ticket originated
alter table public.support_tickets
  add column source text not null default 'portal';

alter table public.support_tickets
  add constraint support_tickets_source_check
  check (source in ('portal', 'email', 'api'));

-- Add customer_email for email-originated tickets (where user_id may be null)
alter table public.support_tickets
  add column customer_email text;

-- Make user_id nullable so email tickets from unknown senders can be created
alter table public.support_tickets
  alter column user_id drop not null;

-- Update RLS: "Users can read own tickets" must handle null user_id
drop policy if exists "Users can read own tickets" on public.support_tickets;
create policy "Users can read own tickets"
  on public.support_tickets for select
  using (user_id is not null and auth.uid() = user_id);

-- Update RLS: "Users can create own tickets" must handle null user_id
drop policy if exists "Users can create own tickets" on public.support_tickets;
create policy "Users can create own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ALTER site_config: add cs_agent_config
-- ---------------------------------------------------------------------------
alter table public.site_config
  add column cs_agent_config jsonb not null
  default '{"enabled": false, "agent_slug": "support", "auto_reply": true}'::jsonb;
