-- =============================================================================
-- Migration 00023: Drop pg_cron Jobs (Replaced by Worker Process)
-- =============================================================================
-- The worker process (migration 00022) now handles all scheduled jobs.
-- This migration drops any pg_cron jobs and extensions that were created by
-- migration 00013 on existing databases. Safe to run on databases where
-- pg_cron was never installed (all operations are guarded).
-- =============================================================================

DO $$ BEGIN
  -- Only attempt cleanup if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule all known jobs
    BEGIN
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.unschedule('process-content-queue');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.unschedule('daily-engagement-check');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.unschedule('weekly-ceo-briefing');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      PERFORM cron.unschedule('stripe-sync');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
