CREATE TABLE public.testimonial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type text NOT NULL, -- 'course_milestone', 'purchase_anniversary', 'engagement'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'submitted', 'dismissed', 'expired'
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonial_requests ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own requests
CREATE POLICY "Users can view own requests" ON public.testimonial_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own requests" ON public.testimonial_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "Admin full access testimonial_requests" ON public.testimonial_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role full access
CREATE POLICY "Service role access testimonial_requests" ON public.testimonial_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE UNIQUE INDEX idx_testimonial_requests_user_id ON public.testimonial_requests(user_id);
CREATE INDEX idx_testimonial_requests_status ON public.testimonial_requests(status);

COMMENT ON TABLE public.testimonial_requests IS 'Tracks testimonial requests sent to customers based on engagement milestones';
