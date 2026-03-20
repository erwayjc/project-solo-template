-- ---------------------------------------------------------------------------
-- Add resend_webhook_secret to site_config
-- ---------------------------------------------------------------------------
-- Stores the Resend webhook signing secret (encrypted) in the database so
-- the configure_inbound_email tool can auto-register webhooks via the Resend
-- API without requiring the user to manually set RESEND_WEBHOOK_SECRET.
-- ---------------------------------------------------------------------------

alter table public.site_config
  add column resend_webhook_secret text;

comment on column public.site_config.resend_webhook_secret
  is 'AES-256-GCM encrypted Resend webhook signing secret. Set automatically when inbound email is configured via the configure_inbound_email tool.';
