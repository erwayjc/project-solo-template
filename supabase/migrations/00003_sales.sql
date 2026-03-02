-- =============================================================================
-- Migration 00003: Sales — leads & pages
-- =============================================================================
-- Lead capture / CRM table and a flexible JSON-driven pages table for
-- landing pages, sales pages, and other marketing content.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: leads
-- Captured email leads from opt-in forms, lead magnets, etc. Each email is
-- unique; duplicates should be handled with upsert logic in the app layer.
-- ---------------------------------------------------------------------------
create table public.leads (
  id              uuid        primary key default gen_random_uuid(),
  email           text        not null,
  name            text,
  source          text        not null default 'opt-in',
  status          text        not null default 'new'
                              check (status in ('new', 'nurturing', 'qualified', 'converted', 'lost')),
  lead_magnet     text,
  tags            text[]      not null default '{}',
  metadata        jsonb       not null default '{}',
  unsubscribed    boolean     not null default false,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (email)
);

comment on table public.leads is 'Email leads captured from opt-in forms and lead magnets.';

create index idx_leads_email        on public.leads (email);
create index idx_leads_status       on public.leads (status);
create index idx_leads_source       on public.leads (source);
create index idx_leads_created_at   on public.leads (created_at);
create index idx_leads_tags         on public.leads using gin (tags);

-- RLS
alter table public.leads enable row level security;

-- Only admin can access leads
create policy "Admin full access to leads"
  on public.leads for all
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

-- Service role access for webhook / API operations (e.g. form submissions)
create policy "Service role full access to leads"
  on public.leads for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: pages
-- Flexible landing / sales pages built from a JSON sections array. Each page
-- is identified by a unique slug for clean URLs.
-- ---------------------------------------------------------------------------
create table public.pages (
  id           uuid    primary key default gen_random_uuid(),
  slug         text    unique not null,
  sections     jsonb   not null default '[]',
  seo          jsonb   not null default '{}',
  is_published boolean not null default true
);

comment on table public.pages is 'JSON-driven landing pages and sales pages, keyed by slug.';

create index idx_pages_slug         on public.pages (slug);
create index idx_pages_is_published on public.pages (is_published);

-- RLS
alter table public.pages enable row level security;

-- Anyone can read published pages (public marketing content)
create policy "Anyone can read published pages"
  on public.pages for select
  using (is_published = true);

-- Admin full CRUD
create policy "Admin full access to pages"
  on public.pages for all
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
