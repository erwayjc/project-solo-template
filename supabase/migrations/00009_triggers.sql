-- =============================================================================
-- Migration 00009: Triggers — database automation hooks
-- =============================================================================
-- Defines triggers that fire on key database events. Some call real functions
-- (profile creation, updated_at), while others are placeholder hooks that will
-- be wired to Edge Functions / API routes in production.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. on_auth_user_created
-- ---------------------------------------------------------------------------
-- The function public.handle_new_user() was already created in 00001_core_auth.
-- The trigger on auth.users was also created there.  We document it here for
-- completeness but do NOT re-create it — doing so would error on duplicate.
--
-- trigger: on_auth_user_created
-- table:   auth.users
-- event:   AFTER INSERT
-- action:  Calls public.handle_new_user() which inserts a profiles row with
--          the user's id, email, and full_name from raw_user_meta_data.

-- ---------------------------------------------------------------------------
-- 2. on_new_lead
-- ---------------------------------------------------------------------------
-- Fires when a new lead row is inserted.
-- In production this would:
--   - Add the lead to the Resend audience via API
--   - Queue the welcome email sequence for this lead
-- For now we log a notice as a placeholder.

create or replace function public.handle_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TODO: Production implementation
  -- 1. Call Resend API to add contact to audience (via pg_net or Edge Function)
  -- 2. Queue welcome email sequence: insert into email_sends for sequence steps
  -- Example:
  --   perform net.http_post(
  --     url := current_setting('app.settings.site_url') || '/api/integrations/resend/audience',
  --     body := json_build_object('email', new.email, 'name', new.name)::text
  --   );
  raise log 'on_new_lead: lead % created (email: %). Resend audience sync + welcome sequence pending.', new.id, new.email;
  return new;
end;
$$;

create trigger on_new_lead
  after insert on public.leads
  for each row
  execute function public.handle_new_lead();

-- ---------------------------------------------------------------------------
-- 3. on_new_customer
-- ---------------------------------------------------------------------------
-- Fires when a profile's role is updated to 'customer'.
-- In production this would:
--   - Trigger the onboarding email sequence
--   - Create a welcome notification / announcement
-- For now we log a notice as a placeholder.

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'customer' and (old.role is distinct from 'customer') then
    -- TODO: Production implementation
    -- 1. Queue onboarding email sequence for this customer
    -- 2. Create welcome notification visible in portal
    -- Example:
    --   insert into email_sends (recipient_email, sequence_id, step_id, status)
    --     select new.email, es.id, ess.id, 'queued'
    --     from email_sequences es
    --     join email_sequence_steps ess on ess.sequence_id = es.id
    --     where es.trigger = 'purchase'
    --     order by ess.step_number;
    raise log 'on_new_customer: profile % upgraded to customer. Onboarding sequence pending.', new.id;
  end if;
  return new;
end;
$$;

create trigger on_new_customer
  after update on public.profiles
  for each row
  execute function public.handle_new_customer();

-- ---------------------------------------------------------------------------
-- 4. on_new_support_ticket
-- ---------------------------------------------------------------------------
-- Fires when a new support_ticket is created.
-- In production this would:
--   - Invoke the AI support agent to attempt a Tier 1 response
--   - If the agent cannot resolve, set status to 'escalated'
-- For now we log a notice as a placeholder.

create or replace function public.handle_new_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TODO: Production implementation
  -- 1. Call AI support agent endpoint to attempt auto-response
  -- Example:
  --   perform net.http_post(
  --     url := current_setting('app.settings.site_url') || '/api/support',
  --     body := json_build_object('ticket_id', new.id, 'subject', new.subject)::text
  --   );
  raise log 'on_new_support_ticket: ticket % created by user %. AI triage pending.', new.id, new.user_id;
  return new;
end;
$$;

create trigger on_new_support_ticket
  after insert on public.support_tickets
  for each row
  execute function public.handle_new_support_ticket();

-- ---------------------------------------------------------------------------
-- 5. on_email_opened
-- ---------------------------------------------------------------------------
-- Fires when an email_sends row has its status updated to 'opened'.
-- In production this would:
--   - Update the lead/customer engagement score
--   - Potentially trigger follow-up actions based on engagement rules
-- For now we log a notice as a placeholder.

create or replace function public.handle_email_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'opened' and (old.status is distinct from 'opened') then
    -- TODO: Production implementation
    -- 1. Look up the lead/customer by recipient_email
    -- 2. Increment engagement score in profiles.metadata
    -- 3. Evaluate engagement rules for follow-up triggers
    -- Example:
    --   update profiles
    --     set metadata = jsonb_set(
    --       metadata,
    --       '{engagement_score}',
    --       to_jsonb(coalesce((metadata->>'engagement_score')::int, 0) + 1)
    --     )
    --     where email = new.recipient_email;
    raise log 'on_email_opened: email send % opened by %. Engagement scoring pending.', new.id, new.recipient_email;
  end if;
  return new;
end;
$$;

create trigger on_email_opened
  after update on public.email_sends
  for each row
  execute function public.handle_email_opened();

-- ---------------------------------------------------------------------------
-- 6. updated_at trigger for agent_conversations
-- ---------------------------------------------------------------------------
-- Automatically sets updated_at = now() whenever an agent_conversations row
-- is updated (e.g. when a new message is appended to the messages array).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_agent_conversations_updated_at
  before update on public.agent_conversations
  for each row
  execute function public.set_updated_at();
