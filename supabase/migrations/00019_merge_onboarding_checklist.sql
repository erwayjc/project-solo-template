-- Atomic JSONB merge for onboarding checklist (avoids read-then-write race)
create or replace function public.merge_onboarding_checklist(updates jsonb)
returns void
language sql
security definer
as $$
  update public.site_config
  set onboarding_checklist = onboarding_checklist || updates
  where id = 1;
$$;

-- Only service role can call this
revoke all on function public.merge_onboarding_checklist(jsonb) from public, anon, authenticated;
grant execute on function public.merge_onboarding_checklist(jsonb) to service_role;
