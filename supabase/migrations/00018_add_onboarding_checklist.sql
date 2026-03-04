-- 00018_add_onboarding_checklist.sql
-- Adds onboarding_checklist JSONB column and stripe_connect_account_id to site_config
-- for the progressive activation onboarding model.

alter table public.site_config
  add column if not exists onboarding_checklist jsonb not null default '{}'::jsonb;

alter table public.site_config
  add column if not exists stripe_connect_account_id text;
