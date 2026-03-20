-- =============================================================================
-- Migration 00029: Security & Integrity Constraints
-- =============================================================================
-- Addresses 5 database-level security and integrity issues:
--   1. Lessons RLS: restrict to purchased/free content only
--   2. Agents RLS: require authentication for non-admin reads
--   3. Purchases FK: already RESTRICT by default (no change needed, documented)
--   4. Content queue FK: ON DELETE SET NULL for source_content_id
--   5. Email sends unique constraint: prevent duplicate webhook processing
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fix 1: Tighten RLS on lessons
-- ---------------------------------------------------------------------------
-- BEFORE: Any visitor could read all published lessons regardless of purchase.
-- AFTER:  Published lessons are only visible if:
--   (a) the module has no product (free content), OR
--   (b) the user purchased the module's product, OR
--   (c) the user is an admin.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read published lessons" ON public.lessons;

CREATE POLICY "Users can read purchased or free lessons"
  ON public.lessons FOR SELECT
  USING (
    is_published = true AND (
      -- Free lessons: module has no associated product
      EXISTS (
        SELECT 1 FROM public.modules m
        WHERE m.id = lessons.module_id AND m.product_id IS NULL
      )
      OR
      -- Purchased lessons: user owns a purchase for the module's product
      EXISTS (
        SELECT 1 FROM public.purchases p
        JOIN public.modules m ON m.product_id = p.product_id
        WHERE m.id = lessons.module_id AND p.user_id = auth.uid()
      )
      OR
      -- Admin access: admins can read all published lessons
      EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role = 'admin'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Fix 2: Agents table RLS — require authentication for non-admin reads
-- ---------------------------------------------------------------------------
-- BEFORE: "Anyone can read active agents" allowed unauthenticated access.
-- AFTER:  Only authenticated users can read active agents. Admins see all.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read active agents" ON public.agents;

CREATE POLICY "Authenticated users can read active agents"
  ON public.agents FOR SELECT
  USING (
    is_active = true AND auth.uid() IS NOT NULL
  );

-- Note: "Admin can read all agents" policy (from 00007) already grants admins
-- visibility into inactive agents. No change needed for that policy.

-- ---------------------------------------------------------------------------
-- Fix 3: Purchases FK cascade behavior — NO CHANGE NEEDED
-- ---------------------------------------------------------------------------
-- purchases.product_id references products(id) with default NO ACTION/RESTRICT.
-- This is correct: products with existing purchases should NOT be deletable.
-- The application layer should deactivate products instead of deleting them.
-- Documenting this as intentional — no DDL changes required.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Fix 4: Content queue FK — change to ON DELETE SET NULL
-- ---------------------------------------------------------------------------
-- BEFORE: content_queue.source_content_id FK used default RESTRICT, preventing
--   blog post deletion if any queued content references it.
-- AFTER:  ON DELETE SET NULL — deleting a blog post nullifies the reference
--   but preserves the queued social content.
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_queue
  DROP CONSTRAINT IF EXISTS content_queue_source_content_id_fkey;

ALTER TABLE public.content_queue
  ADD CONSTRAINT content_queue_source_content_id_fkey
  FOREIGN KEY (source_content_id) REFERENCES public.blog_posts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Fix 5: Unique constraint on email_sends.resend_id
-- ---------------------------------------------------------------------------
-- Prevents duplicate email send records from Resend webhook retries.
-- The resend_id column can be NULL (for queued emails not yet sent),
-- so we use a unique index which naturally excludes NULLs in PostgreSQL.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sends_resend_id_unique
  ON public.email_sends (resend_id)
  WHERE resend_id IS NOT NULL;
