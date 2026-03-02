-- =============================================================================
-- Migration 00004: Email — sequences, steps, sends, broadcasts, enrollments
-- =============================================================================
-- Full email automation schema: drip sequences with timed steps, per-send
-- tracking, broadcast campaigns, and enrollment state machines.
-- All tables are admin-only + service role (for cron jobs and webhooks).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: email_sequences
-- A named drip / automation sequence with a trigger type.
-- ---------------------------------------------------------------------------
create table public.email_sequences (
  id        uuid    primary key default gen_random_uuid(),
  name      text    not null,
  trigger   text    not null default 'manual'
                    check (trigger in ('opt_in', 'purchase', 'abandoned', 'reactivation', 'manual')),
  is_active boolean not null default false
);

comment on table public.email_sequences is 'Drip / automation sequences triggered by events or manually.';

-- RLS
alter table public.email_sequences enable row level security;

create policy "Admin full access to email_sequences"
  on public.email_sequences for all
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

create policy "Service role full access to email_sequences"
  on public.email_sequences for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: email_sequence_steps
-- Individual emails within a sequence, ordered by step_number with a delay.
-- ---------------------------------------------------------------------------
create table public.email_sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_number int  not null,
  subject     text not null,
  body        text not null,
  delay_hours int  not null default 0
);

comment on table public.email_sequence_steps is 'Individual timed steps within an email sequence.';

create index idx_email_sequence_steps_sequence_id on public.email_sequence_steps (sequence_id);
create index idx_email_sequence_steps_step_number on public.email_sequence_steps (sequence_id, step_number);

-- RLS
alter table public.email_sequence_steps enable row level security;

create policy "Admin full access to email_sequence_steps"
  on public.email_sequence_steps for all
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

create policy "Service role full access to email_sequence_steps"
  on public.email_sequence_steps for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: email_sends
-- Per-email send log. Tracks delivery lifecycle (queued -> sent -> delivered
-- -> opened -> clicked) and links back to the originating sequence / step.
-- ---------------------------------------------------------------------------
create table public.email_sends (
  id              uuid        primary key default gen_random_uuid(),
  recipient_email text        not null,
  sequence_id     uuid        references public.email_sequences(id),
  step_id         uuid        references public.email_sequence_steps(id),
  resend_id       text,
  status          text        not null default 'queued'
                              check (status in ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced')),
  sent_at         timestamptz,
  opened_at       timestamptz
);

comment on table public.email_sends is 'Individual email send log with delivery status tracking.';

create index idx_email_sends_recipient_email on public.email_sends (recipient_email);
create index idx_email_sends_sequence_id     on public.email_sends (sequence_id);
create index idx_email_sends_step_id         on public.email_sends (step_id);
create index idx_email_sends_status          on public.email_sends (status);
create index idx_email_sends_sent_at         on public.email_sends (sent_at);

-- RLS
alter table public.email_sends enable row level security;

create policy "Admin full access to email_sends"
  on public.email_sends for all
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

create policy "Service role full access to email_sends"
  on public.email_sends for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: broadcasts
-- One-off broadcast emails to a filtered audience segment. Includes send
-- stats (populated by webhook callbacks).
-- ---------------------------------------------------------------------------
create table public.broadcasts (
  id              uuid        primary key default gen_random_uuid(),
  subject         text        not null,
  body            text        not null,
  audience_filter jsonb       not null default '{}',
  status          text        not null default 'draft'
                              check (status in ('draft', 'scheduled', 'sending', 'sent')),
  scheduled_for   timestamptz,
  sent_at         timestamptz,
  stats           jsonb       not null default '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0}'
);

comment on table public.broadcasts is 'One-off broadcast email campaigns with audience filtering and stats.';

create index idx_broadcasts_status        on public.broadcasts (status);
create index idx_broadcasts_scheduled_for on public.broadcasts (scheduled_for);

-- RLS
alter table public.broadcasts enable row level security;

create policy "Admin full access to broadcasts"
  on public.broadcasts for all
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

create policy "Service role full access to broadcasts"
  on public.broadcasts for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: sequence_enrollments
-- Tracks a specific email address's progress through a sequence. The cron
-- job / edge function advances current_step and updates next_send_at.
-- ---------------------------------------------------------------------------
create table public.sequence_enrollments (
  id           uuid        primary key default gen_random_uuid(),
  email        text        not null,
  sequence_id  uuid        not null references public.email_sequences(id) on delete cascade,
  current_step int         not null default 1,
  status       text        not null default 'active'
                           check (status in ('active', 'completed', 'paused', 'unsubscribed')),
  started_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  next_send_at timestamptz,
  completed_at timestamptz,
  unique (email, sequence_id)
);

comment on table public.sequence_enrollments is 'Per-subscriber enrollment state within an email sequence.';

create index idx_sequence_enrollments_email       on public.sequence_enrollments (email);
create index idx_sequence_enrollments_sequence_id on public.sequence_enrollments (sequence_id);
create index idx_sequence_enrollments_status      on public.sequence_enrollments (status);
create index idx_sequence_enrollments_next_send   on public.sequence_enrollments (next_send_at);

-- RLS
alter table public.sequence_enrollments enable row level security;

create policy "Admin full access to sequence_enrollments"
  on public.sequence_enrollments for all
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

create policy "Service role full access to sequence_enrollments"
  on public.sequence_enrollments for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
