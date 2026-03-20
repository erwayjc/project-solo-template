-- Add processing lock column to prevent concurrent cron workers from
-- processing the same enrollment row simultaneously.
alter table public.sequence_enrollments
  add column if not exists processing_started_at timestamptz;

comment on column public.sequence_enrollments.processing_started_at
  is 'Timestamp when a cron worker claimed this row for processing. NULL means available. Stale locks (>5 min) are treated as available.';
