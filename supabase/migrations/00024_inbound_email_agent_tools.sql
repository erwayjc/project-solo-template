-- ---------------------------------------------------------------------------
-- Grant inbound email tools to the Dev Agent
-- ---------------------------------------------------------------------------
-- Adds send_customer_email, get_cs_email_stats, configure_inbound_email,
-- and get_inbound_email_config so the Dev Agent can set up and manage
-- the inbound email support pipeline.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from public.agents where slug = 'dev-agent') then
    update public.agents
    set tools = array_cat(tools, ARRAY[
      'send_customer_email',
      'get_cs_email_stats',
      'configure_inbound_email',
      'get_inbound_email_config'
    ])
    where slug = 'dev-agent'
      and not tools @> ARRAY['configure_inbound_email'];
  end if;
end $$;
