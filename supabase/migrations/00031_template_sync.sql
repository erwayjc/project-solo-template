-- Track template version and upstream sync state
alter table public.site_config
  add column if not exists template_version text not null default '0.0.0';

alter table public.site_config
  add column if not exists last_migration_number int not null default 0;

alter table public.site_config
  add column if not exists update_available boolean not null default false;

alter table public.site_config
  add column if not exists update_history jsonb not null default '[]'::jsonb;
