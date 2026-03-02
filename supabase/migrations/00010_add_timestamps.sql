-- =============================================================================
-- Migration 00010: Add missing timestamp columns
-- =============================================================================
-- Several tables were created without created_at / updated_at columns that
-- the application code expects for filtering and auditing. This migration
-- adds them with sensible defaults.
-- =============================================================================

-- blog_posts
alter table public.blog_posts
  add column if not exists created_at timestamptz not null default now();

-- content_queue
alter table public.content_queue
  add column if not exists created_at timestamptz not null default now();

-- modules
alter table public.modules
  add column if not exists created_at timestamptz not null default now();

-- lessons
alter table public.lessons
  add column if not exists created_at timestamptz not null default now();

-- email_sequences
alter table public.email_sequences
  add column if not exists created_at timestamptz not null default now();

-- email_sequence_steps
alter table public.email_sequence_steps
  add column if not exists created_at timestamptz not null default now();

-- email_sends
alter table public.email_sends
  add column if not exists created_at timestamptz not null default now();

-- broadcasts
alter table public.broadcasts
  add column if not exists created_at timestamptz not null default now();

-- pages
alter table public.pages
  add column if not exists created_at timestamptz not null default now();

-- lesson_progress
alter table public.lesson_progress
  add column if not exists created_at timestamptz not null default now();

-- purchases (has purchased_at but code also references created_at)
alter table public.purchases
  add column if not exists created_at timestamptz not null default now();

-- sequence_enrollments (has started_at but code also references created_at)
alter table public.sequence_enrollments
  add column if not exists created_at timestamptz not null default now();
