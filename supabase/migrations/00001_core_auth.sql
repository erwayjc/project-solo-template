-- =============================================================================
-- Migration 00001: Core Auth — profiles & site_config
-- =============================================================================
-- Extends Supabase auth.users with a public profiles table and provides a
-- single-row site_config table for global site settings.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: profiles
-- Extends auth.users with application-specific fields (name, role, Stripe /
-- Resend IDs, email preferences, and arbitrary metadata).
-- A trigger (below) auto-creates a row here whenever a new auth user signs up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  full_name         text,
  email             text,
  role              text        not null default 'lead'
                                check (role in ('admin', 'customer', 'lead')),
  stripe_customer_id text,
  resend_contact_id  text,
  email_opt_out     boolean     not null default false,
  metadata          jsonb       not null default '{}',
  created_at        timestamptz not null default now()
);

comment on table  public.profiles is 'Public profile that extends every Supabase auth user.';
comment on column public.profiles.role is 'One of admin, customer, or lead. Defaults to lead on signup.';

-- Indexes
create index idx_profiles_email              on public.profiles (email);
create index idx_profiles_role               on public.profiles (role);
create index idx_profiles_stripe_customer_id on public.profiles (stripe_customer_id);

-- RLS
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile, but cannot change their role
create policy "Users can update own profile"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Admin can read all profiles
create policy "Admin can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role bypasses RLS automatically, but we add an explicit policy for
-- webhook / server-side operations running with the service_role key so that
-- inserts and updates succeed even when RLS is checked (e.g. during tests).
create policy "Service role full access"
  on public.profiles for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: site_config
-- Single-row table (id is always 1) holding global site settings: branding,
-- SEO defaults, admin user reference, legal info, and setup status.
-- ---------------------------------------------------------------------------
create table public.site_config (
  id                   int         primary key default 1 check (id = 1),
  site_name            text        not null default 'My Business',
  tagline              text        not null default '',
  logo_url             text,
  brand_colors         jsonb       not null default '{"primary": "#2563eb", "secondary": "#1e40af", "accent": "#f59e0b", "background": "#ffffff", "text": "#111827"}',
  social_links         jsonb       not null default '{}',
  seo_defaults         jsonb       not null default '{"title": "", "description": "", "og_image": "", "keywords": ""}',
  master_context       text        not null default '',
  admin_user_id        uuid        references auth.users(id),
  setup_complete       boolean     not null default false,
  analytics_id         text,
  legal_business_name  text,
  legal_contact_email  text
);

comment on table public.site_config is 'Single-row table (id=1) for global site configuration.';

-- Seed the single row so that UPDATEs always have a target.
insert into public.site_config (id) values (1);

-- RLS
alter table public.site_config enable row level security;

-- Anyone (including anonymous / unauthenticated) can read public site config
create policy "Anyone can read site config"
  on public.site_config for select
  using (true);

-- Only admin can update site config
create policy "Admin can update site config"
  on public.site_config for update
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

-- ---------------------------------------------------------------------------
-- Trigger: auto-create a profile row when a new auth.users record is inserted
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer          -- runs with table-owner privileges
set search_path = public  -- avoid search-path hijacking
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
