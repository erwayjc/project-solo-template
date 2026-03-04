-- =============================================================================
-- Migration 00013: Cron Automation & Testimonials
-- =============================================================================
-- 1. Creates the testimonials table for admin-managed social proof.
-- 2. Enables pg_cron and pg_net extensions for background job scheduling.
-- 3. Schedules 5 cron jobs that POST to Next.js API routes with secret auth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: testimonials
-- ---------------------------------------------------------------------------
create table public.testimonials (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  quote        text        not null,
  role         text,
  company      text,
  image_url    text,
  sort_order   int         not null default 0,
  is_published boolean     not null default false,
  created_at   timestamptz not null default now()
);

comment on table  public.testimonials is 'Customer testimonials managed by admin and displayed on public pages.';
comment on column public.testimonials.sort_order is 'Manual display ordering. Lower numbers appear first.';
comment on column public.testimonials.is_published is 'Only published testimonials are visible on public pages.';

-- Indexes
create index idx_testimonials_published  on public.testimonials (is_published);
create index idx_testimonials_sort_order on public.testimonials (sort_order);
create index idx_testimonials_created_at on public.testimonials (created_at);

-- RLS
alter table public.testimonials enable row level security;

-- Public can read published testimonials
create policy "Anyone can read published testimonials"
  on public.testimonials for select
  using (is_published = true);

-- Admin can read all testimonials
create policy "Admin can read all testimonials"
  on public.testimonials for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can create testimonials
create policy "Admin can create testimonials"
  on public.testimonials for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can update testimonials
create policy "Admin can update testimonials"
  on public.testimonials for update
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

-- Admin can delete testimonials
create policy "Admin can delete testimonials"
  on public.testimonials for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role full access
create policy "Service role full access on testimonials"
  on public.testimonials for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Extensions: pg_cron and pg_net
-- ---------------------------------------------------------------------------
-- pg_cron allows scheduling recurring SQL jobs (like Unix cron).
-- pg_net allows making async HTTP requests from within PostgreSQL.
-- Together they let us POST to Next.js API routes on a schedule.
-- Both are available on all Supabase tiers including free.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Cron Jobs: Schedule 5 background automation jobs
-- ---------------------------------------------------------------------------
-- Each job uses pg_net to POST to a Next.js API route with a CRON_SECRET
-- bearer token for authentication. The SITE_URL and CRON_SECRET are read
-- from Supabase vault secrets at execution time (not schedule time).
--
-- To configure, set these secrets in your Supabase dashboard:
--   vault.secrets: site_url = "https://your-app.vercel.app"
--   vault.secrets: cron_secret = "your-random-secret"
--
-- Or use current_setting:
--   ALTER DATABASE postgres SET app.settings.site_url = 'https://...';
--   ALTER DATABASE postgres SET app.settings.cron_secret = 'your-secret';
-- ---------------------------------------------------------------------------

-- Job 1: Process Email Queue — every 5 minutes
-- Sends due email sequence steps to enrolled subscribers.
DO $$ BEGIN
  PERFORM cron.schedule(
    'process-email-queue',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
      url := current_setting('app.settings.site_url') || '/api/cron/email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job 2: Process Content Queue — every 10 minutes
-- Publishes approved social content via Buffer API.
DO $$ BEGIN
  PERFORM cron.schedule(
    'process-content-queue',
    '*/10 * * * *',
    $$
    SELECT net.http_post(
      url := current_setting('app.settings.site_url') || '/api/cron/content-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job 3: Daily Engagement Check — 9:00 AM UTC daily
-- Flags cold leads (>7d inactive), stalled students (>14d), expiring subs.
DO $$ BEGIN
  PERFORM cron.schedule(
    'daily-engagement-check',
    '0 9 * * *',
    $$
    SELECT net.http_post(
      url := current_setting('app.settings.site_url') || '/api/cron/engagement-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job 4: Weekly CEO Briefing — 9:00 AM UTC every Monday
-- Aggregates 7-day business metrics and emails a summary to the admin.
DO $$ BEGIN
  PERFORM cron.schedule(
    'weekly-ceo-briefing',
    '0 9 * * 1',
    $$
    SELECT net.http_post(
      url := current_setting('app.settings.site_url') || '/api/cron/ceo-briefing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Job 5: Stripe Sync — every 6 hours
-- Syncs Stripe products/prices to the local products table,
-- and updates purchase statuses for past_due/canceled subscriptions.
DO $$ BEGIN
  PERFORM cron.schedule(
    'stripe-sync',
    '0 */6 * * *',
    $$
    SELECT net.http_post(
      url := current_setting('app.settings.site_url') || '/api/cron/stripe-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
