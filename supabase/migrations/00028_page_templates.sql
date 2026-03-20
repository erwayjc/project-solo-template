-- ---------------------------------------------------------------------------
-- Migration 00028: Page Templates
-- A library of high-quality HTML/CSS page templates the Dev Agent can use
-- as starting points for custom page generation. Each template uses CSS
-- custom properties (--brand-*) so they automatically adopt the user's brand.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.page_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  category    text        NOT NULL CHECK (category IN (
    'landing', 'sales', 'opt-in', 'webinar', 'course-launch', 'about', 'waitlist', 'showcase'
  )),
  description text        NOT NULL DEFAULT '',
  html_content text       NOT NULL,
  design_notes text       NOT NULL DEFAULT '',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_page_templates_category ON public.page_templates (category);
CREATE INDEX IF NOT EXISTS idx_page_templates_is_active ON public.page_templates (is_active);

-- RLS
ALTER TABLE public.page_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active templates
CREATE POLICY "Authenticated users can read active templates"
  ON public.page_templates FOR SELECT
  USING (is_active = true);

-- Admin full CRUD
CREATE POLICY "Admin full access to page_templates"
  ON public.page_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to page_templates"
  ON public.page_templates FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.page_templates IS
  'Library of starter HTML/CSS page templates for the Dev Agent to customize.';

-- Grant page template tools to dev-agent
UPDATE public.agents
SET tools = array_cat(tools, ARRAY[
  'list_page_templates', 'get_page_template',
  'save_page_design_tokens', 'get_page_design_tokens'
])
WHERE slug = 'dev-agent'
  AND NOT tools @> ARRAY['list_page_templates'];

-- ---------------------------------------------------------------------------
-- Seed templates
-- Each template uses var(--brand-*) CSS custom properties so they
-- automatically adopt the user's brand colors when rendered.
-- ---------------------------------------------------------------------------

-- 1. Lead Magnet Landing Page
INSERT INTO public.page_templates (name, category, description, design_notes, html_content) VALUES (
  'Lead Magnet Landing Page',
  'landing',
  'Clean landing page for free guides, checklists, or downloads. Hero headline, benefit bullets, email capture form, and social proof section.',
  'Customize: headline, subheadline, benefit items, CTA text, social proof quotes. The form submits to /api/leads/capture. Replace placeholder text but keep the layout structure — it''s optimized for conversion. Add urgency element (limited spots, countdown) if authentic.',
  '<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--brand-font-body, system-ui, -apple-system, sans-serif); color: var(--brand-text, #111827); background: var(--brand-background, #ffffff); }
  .hero { min-height: 90vh; display: flex; align-items: center; justify-content: center; padding: 3rem 1.5rem; background: linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, var(--brand-secondary, #1e40af) 100%); color: #fff; }
  .hero-inner { max-width: 640px; text-align: center; }
  .hero h1 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.15; margin-bottom: 1.25rem; }
  .hero p { font-size: clamp(1rem, 2.5vw, 1.25rem); opacity: 0.9; margin-bottom: 2rem; line-height: 1.6; }
  .capture-form { display: flex; gap: 0.75rem; max-width: 460px; margin: 0 auto; }
  .capture-form input { flex: 1; padding: 0.875rem 1rem; border: none; border-radius: 8px; font-size: 1rem; }
  .capture-form button { padding: 0.875rem 1.75rem; background: var(--brand-accent, #f59e0b); color: #111; border: none; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; white-space: nowrap; transition: transform 0.15s; }
  .capture-form button:hover { transform: translateY(-1px); }
  .benefits { padding: 5rem 1.5rem; max-width: 800px; margin: 0 auto; }
  .benefits h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2.25rem); text-align: center; margin-bottom: 3rem; }
  .benefit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2rem; }
  .benefit-card { padding: 1.5rem; border-radius: 12px; background: #f9fafb; }
  .benefit-card h3 { font-size: 1.125rem; margin-bottom: 0.5rem; color: var(--brand-primary, #2563eb); }
  .benefit-card p { font-size: 0.95rem; line-height: 1.6; color: #4b5563; }
  .social-proof { padding: 4rem 1.5rem; background: #f9fafb; text-align: center; }
  .social-proof blockquote { max-width: 600px; margin: 0 auto; font-size: 1.125rem; font-style: italic; line-height: 1.7; color: #374151; }
  .social-proof cite { display: block; margin-top: 1rem; font-style: normal; font-weight: 600; color: var(--brand-primary, #2563eb); }
  @media (max-width: 640px) {
    .capture-form { flex-direction: column; }
    .hero { padding: 2rem 1rem; }
  }
</style>

<section class="hero">
  <div class="hero-inner">
    <h1>Get Your Free [Resource Name]</h1>
    <p>A short, compelling description of what they''ll get and why it matters. Focus on the transformation, not the format.</p>
    <form class="capture-form" action="/api/leads/capture" method="POST">
      <input type="email" name="email" placeholder="Enter your email" required>
      <input type="hidden" name="source" value="lead-magnet">
      <button type="submit">Get Instant Access</button>
    </form>
  </div>
</section>

<section class="benefits">
  <h2>What You''ll Learn</h2>
  <div class="benefit-grid">
    <div class="benefit-card">
      <h3>Benefit One</h3>
      <p>Describe the first key takeaway or benefit the reader will get from this resource.</p>
    </div>
    <div class="benefit-card">
      <h3>Benefit Two</h3>
      <p>Describe the second key takeaway. Be specific — numbers and outcomes work best.</p>
    </div>
    <div class="benefit-card">
      <h3>Benefit Three</h3>
      <p>Describe the third key takeaway. Connect it to a real pain point they have.</p>
    </div>
  </div>
</section>

<section class="social-proof">
  <blockquote>"This resource completely changed how I approach [topic]. I went from [before state] to [after state] in just [timeframe]."</blockquote>
  <cite>— Customer Name, Title</cite>
</section>'
);

-- 2. Sales Page (Long-form)
INSERT INTO public.page_templates (name, category, description, design_notes, html_content) VALUES (
  'Long-Form Sales Page',
  'sales',
  'Conversion-optimized sales page with hook headline, problem-agitation-solution flow, testimonials, pricing section, FAQ, and multiple CTAs.',
  'This follows the PAS (Problem-Agitation-Solution) framework. Customize each section but preserve the psychological flow. The pricing section supports both one-time and subscription models. FAQ section should address the top 5-7 objections. Every scroll-depth section has a CTA — don''t remove them.',
  '<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--brand-font-body, system-ui, -apple-system, sans-serif); color: var(--brand-text, #111827); background: var(--brand-background, #ffffff); line-height: 1.7; }
  .sales-hero { padding: 6rem 1.5rem 4rem; text-align: center; max-width: 760px; margin: 0 auto; }
  .sales-hero .kicker { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; color: var(--brand-accent, #f59e0b); font-weight: 700; margin-bottom: 1rem; }
  .sales-hero h1 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(2.25rem, 5vw, 3.75rem); line-height: 1.12; margin-bottom: 1.5rem; }
  .sales-hero .subtitle { font-size: clamp(1.05rem, 2.5vw, 1.3rem); color: #4b5563; max-width: 600px; margin: 0 auto 2rem; }
  .cta-btn { display: inline-block; padding: 1rem 2.5rem; background: var(--brand-primary, #2563eb); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1.125rem; transition: transform 0.15s, box-shadow 0.15s; }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
  .section { padding: 5rem 1.5rem; max-width: 760px; margin: 0 auto; }
  .section-alt { background: #f9fafb; }
  .section-alt .section { padding: 5rem 1.5rem; }
  .section h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2.25rem); margin-bottom: 1.5rem; }
  .problem-list { list-style: none; padding: 0; }
  .problem-list li { padding: 0.75rem 0; padding-left: 2rem; position: relative; font-size: 1.05rem; }
  .problem-list li::before { content: "✕"; position: absolute; left: 0; color: #ef4444; font-weight: 700; }
  .solution-list { list-style: none; padding: 0; }
  .solution-list li { padding: 0.75rem 0; padding-left: 2rem; position: relative; font-size: 1.05rem; }
  .solution-list li::before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: 700; }
  .testimonial-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
  .testimonial-card { padding: 1.5rem; border-radius: 12px; background: #fff; border: 1px solid #e5e7eb; }
  .testimonial-card p { font-style: italic; margin-bottom: 1rem; color: #374151; }
  .testimonial-card .author { font-weight: 700; font-size: 0.9rem; color: var(--brand-primary, #2563eb); }
  .pricing-box { max-width: 480px; margin: 2rem auto; padding: 2.5rem; border-radius: 16px; border: 2px solid var(--brand-primary, #2563eb); text-align: center; }
  .pricing-box .price { font-family: var(--brand-font-heading, Georgia, serif); font-size: 3rem; font-weight: 700; color: var(--brand-primary, #2563eb); }
  .pricing-box .price-note { font-size: 0.9rem; color: #6b7280; margin-bottom: 1.5rem; }
  .pricing-box ul { list-style: none; padding: 0; text-align: left; margin-bottom: 2rem; }
  .pricing-box ul li { padding: 0.5rem 0; padding-left: 1.5rem; position: relative; }
  .pricing-box ul li::before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: 700; }
  .faq-item { border-bottom: 1px solid #e5e7eb; padding: 1.25rem 0; }
  .faq-item h3 { font-size: 1.05rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .faq-item p { margin-top: 0.75rem; color: #4b5563; }
  .final-cta { padding: 5rem 1.5rem; text-align: center; background: linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, var(--brand-secondary, #1e40af) 100%); color: #fff; }
  .final-cta h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.75rem, 4vw, 2.75rem); margin-bottom: 1rem; }
  .final-cta p { font-size: 1.15rem; opacity: 0.9; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }
  .final-cta .cta-btn { background: var(--brand-accent, #f59e0b); color: #111; }
  @media (max-width: 640px) { .sales-hero { padding: 3rem 1rem 2rem; } .section { padding: 3rem 1rem; } }
</style>

<section class="sales-hero">
  <p class="kicker">Introducing</p>
  <h1>The Headline That Captures Your Biggest Promise</h1>
  <p class="subtitle">A compelling subheadline that expands on the promise and speaks directly to your ideal customer''s desire.</p>
  <a href="#pricing" class="cta-btn">Get Started Now →</a>
</section>

<section class="section">
  <h2>You know the feeling...</h2>
  <p style="margin-bottom:1.5rem">Describe the problem your audience faces. Be specific and empathetic — show you understand their pain.</p>
  <ul class="problem-list">
    <li>Pain point one that keeps them stuck</li>
    <li>Pain point two that costs them time or money</li>
    <li>Pain point three that creates frustration</li>
    <li>Pain point four — the deeper emotional cost</li>
  </ul>
</section>

<div class="section-alt">
  <section class="section">
    <h2>There''s a better way</h2>
    <p style="margin-bottom:1.5rem">Introduce your solution. Explain how it solves their specific problems.</p>
    <ul class="solution-list">
      <li>Benefit one — what they get and the outcome</li>
      <li>Benefit two — another transformation</li>
      <li>Benefit three — time/money saved</li>
      <li>Benefit four — the emotional relief</li>
    </ul>
    <div style="text-align:center;margin-top:2rem">
      <a href="#pricing" class="cta-btn">Yes, I want this →</a>
    </div>
  </section>
</div>

<section class="section">
  <h2>What people are saying</h2>
  <div class="testimonial-grid">
    <div class="testimonial-card">
      <p>"Testimonial that speaks to a specific result or transformation."</p>
      <div class="author">Customer Name</div>
    </div>
    <div class="testimonial-card">
      <p>"Testimonial that addresses a common objection and overcomes it."</p>
      <div class="author">Customer Name</div>
    </div>
    <div class="testimonial-card">
      <p>"Testimonial that highlights ease of use or speed of results."</p>
      <div class="author">Customer Name</div>
    </div>
  </div>
</section>

<div id="pricing" class="section-alt">
  <section class="section" style="text-align:center">
    <h2>Simple, transparent pricing</h2>
    <div class="pricing-box">
      <div class="price">$XX</div>
      <div class="price-note">One-time payment · Lifetime access</div>
      <ul>
        <li>Everything included in the program</li>
        <li>Bonus one</li>
        <li>Bonus two</li>
        <li>Bonus three</li>
      </ul>
      <a href="/api/checkout?product=PRODUCT_ID" class="cta-btn" style="width:100%;display:block;text-align:center">Get Instant Access →</a>
    </div>
  </section>
</div>

<section class="section">
  <h2>Frequently asked questions</h2>
  <div class="faq-item">
    <h3>Common objection or question?</h3>
    <p>Address the concern directly and honestly.</p>
  </div>
  <div class="faq-item">
    <h3>Another common question?</h3>
    <p>Provide a clear, reassuring answer.</p>
  </div>
  <div class="faq-item">
    <h3>What if it doesn''t work for me?</h3>
    <p>Describe your guarantee or refund policy.</p>
  </div>
</section>

<section class="final-cta">
  <h2>Ready to [achieve the transformation]?</h2>
  <p>One final compelling reason to take action now.</p>
  <a href="#pricing" class="cta-btn">Get Started Now →</a>
</section>'
);

-- 3. Webinar/Event Registration
INSERT INTO public.page_templates (name, category, description, design_notes, html_content) VALUES (
  'Webinar Registration Page',
  'webinar',
  'Event registration page with countdown timer, speaker bio, learning outcomes, and email capture form.',
  'The countdown timer uses inline JavaScript — update the target date. The form submits to /api/leads/capture with source "webinar". Customize the speaker bio, learning outcomes, and event details. Works for webinars, workshops, live trainings, or any time-bound event.',
  '<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--brand-font-body, system-ui, -apple-system, sans-serif); color: var(--brand-text, #111827); background: var(--brand-background, #ffffff); }
  .webinar-hero { padding: 5rem 1.5rem; background: linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, var(--brand-secondary, #1e40af) 100%); color: #fff; text-align: center; }
  .webinar-hero .badge { display: inline-block; background: var(--brand-accent, #f59e0b); color: #111; padding: 0.375rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; }
  .webinar-hero h1 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(2rem, 5vw, 3.25rem); line-height: 1.15; margin-bottom: 1rem; max-width: 700px; margin-left: auto; margin-right: auto; }
  .webinar-hero p { font-size: 1.15rem; opacity: 0.9; margin-bottom: 2rem; }
  .countdown { display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 2.5rem; }
  .countdown-unit { text-align: center; }
  .countdown-unit .num { font-size: 2.5rem; font-weight: 700; display: block; font-family: var(--brand-font-heading, Georgia, serif); }
  .countdown-unit .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.7; }
  .reg-form { max-width: 400px; margin: 0 auto; }
  .reg-form input { width: 100%; padding: 0.875rem 1rem; border: none; border-radius: 8px; font-size: 1rem; margin-bottom: 0.75rem; }
  .reg-form button { width: 100%; padding: 1rem; background: var(--brand-accent, #f59e0b); color: #111; border: none; border-radius: 8px; font-weight: 700; font-size: 1.05rem; cursor: pointer; transition: transform 0.15s; }
  .reg-form button:hover { transform: translateY(-1px); }
  .details { padding: 5rem 1.5rem; max-width: 760px; margin: 0 auto; }
  .details h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2.25rem); margin-bottom: 2rem; text-align: center; }
  .learn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
  .learn-item { padding: 1.25rem; background: #f9fafb; border-radius: 10px; text-align: center; }
  .learn-item .icon { font-size: 2rem; margin-bottom: 0.75rem; }
  .learn-item h3 { font-size: 1rem; margin-bottom: 0.375rem; }
  .learn-item p { font-size: 0.9rem; color: #6b7280; }
  .speaker { display: flex; gap: 2rem; align-items: center; padding: 3rem 1.5rem; max-width: 760px; margin: 0 auto; }
  .speaker-photo { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-primary, #2563eb), var(--brand-accent, #f59e0b)); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 2.5rem; font-weight: 700; }
  .speaker-info h3 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  .speaker-info .role { color: var(--brand-primary, #2563eb); font-weight: 600; margin-bottom: 0.75rem; font-size: 0.95rem; }
  .speaker-info p { color: #4b5563; line-height: 1.6; }
  @media (max-width: 640px) { .speaker { flex-direction: column; text-align: center; } .countdown .num { font-size: 1.75rem; } }
</style>

<section class="webinar-hero">
  <span class="badge">Free Live Training</span>
  <h1>Your Webinar Title That Promises a Clear Outcome</h1>
  <p>Date · Time · Duration</p>
  <div class="countdown" id="countdown">
    <div class="countdown-unit"><span class="num" id="cd-days">00</span><span class="label">Days</span></div>
    <div class="countdown-unit"><span class="num" id="cd-hours">00</span><span class="label">Hours</span></div>
    <div class="countdown-unit"><span class="num" id="cd-mins">00</span><span class="label">Minutes</span></div>
    <div class="countdown-unit"><span class="num" id="cd-secs">00</span><span class="label">Seconds</span></div>
  </div>
  <form class="reg-form" action="/api/leads/capture" method="POST">
    <input type="text" name="name" placeholder="Your name" required>
    <input type="email" name="email" placeholder="Your best email" required>
    <input type="hidden" name="source" value="webinar">
    <button type="submit">Save My Spot →</button>
  </form>
</section>

<section class="details">
  <h2>What you''ll learn</h2>
  <div class="learn-grid">
    <div class="learn-item">
      <div class="icon">📋</div>
      <h3>Takeaway One</h3>
      <p>Brief description of this learning outcome.</p>
    </div>
    <div class="learn-item">
      <div class="icon">🎯</div>
      <h3>Takeaway Two</h3>
      <p>Brief description of this learning outcome.</p>
    </div>
    <div class="learn-item">
      <div class="icon">🚀</div>
      <h3>Takeaway Three</h3>
      <p>Brief description of this learning outcome.</p>
    </div>
  </div>
</section>

<section class="speaker">
  <div class="speaker-photo">YN</div>
  <div class="speaker-info">
    <h3>Your Name</h3>
    <div class="role">Your Title / Expertise</div>
    <p>A brief bio that establishes credibility and connects with the audience. Focus on relevant experience and results you''ve achieved.</p>
  </div>
</section>

<script>
(function() {
  var target = new Date("2025-12-31T18:00:00Z").getTime();
  function tick() {
    var now = Date.now(), d = target - now;
    if (d < 0) { document.getElementById("countdown").innerHTML = "<p style=\"font-size:1.25rem;font-weight:700\">The event has started!</p>"; return; }
    document.getElementById("cd-days").textContent = String(Math.floor(d/86400000)).padStart(2,"0");
    document.getElementById("cd-hours").textContent = String(Math.floor((d%86400000)/3600000)).padStart(2,"0");
    document.getElementById("cd-mins").textContent = String(Math.floor((d%3600000)/60000)).padStart(2,"0");
    document.getElementById("cd-secs").textContent = String(Math.floor((d%60000)/1000)).padStart(2,"0");
  }
  tick(); setInterval(tick, 1000);
})();
</script>'
);

-- 4. Course Launch
INSERT INTO public.page_templates (name, category, description, design_notes, html_content) VALUES (
  'Course Launch Page',
  'course-launch',
  'Course sales page with module preview, instructor bio, student results, and enrollment CTA. Designed for digital courses and programs.',
  'Customize the module list to match actual course content. The "student results" section is high-impact — use real numbers if possible. The pricing CTA should link to your Stripe checkout. Consider adding a video embed in the hero for higher conversion.',
  '<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--brand-font-body, system-ui, -apple-system, sans-serif); color: var(--brand-text, #111827); background: var(--brand-background, #ffffff); }
  .course-hero { padding: 6rem 1.5rem 4rem; text-align: center; }
  .course-hero .tag { display: inline-block; background: var(--brand-primary, #2563eb); color: #fff; padding: 0.375rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; }
  .course-hero h1 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.12; margin-bottom: 1rem; max-width: 700px; margin-left: auto; margin-right: auto; }
  .course-hero p { font-size: 1.15rem; color: #4b5563; max-width: 600px; margin: 0 auto 2rem; line-height: 1.6; }
  .cta-btn { display: inline-block; padding: 1rem 2.5rem; background: var(--brand-primary, #2563eb); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1.1rem; transition: transform 0.15s, box-shadow 0.15s; }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
  .stats-bar { display: flex; justify-content: center; gap: 3rem; padding: 2.5rem 1.5rem; background: #f9fafb; flex-wrap: wrap; }
  .stat { text-align: center; }
  .stat .num { font-family: var(--brand-font-heading, Georgia, serif); font-size: 2rem; font-weight: 700; color: var(--brand-primary, #2563eb); }
  .stat .desc { font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem; }
  .modules { padding: 5rem 1.5rem; max-width: 700px; margin: 0 auto; }
  .modules h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2.25rem); margin-bottom: 2rem; text-align: center; }
  .module-item { display: flex; gap: 1rem; padding: 1.25rem; border-radius: 10px; margin-bottom: 0.75rem; background: #f9fafb; align-items: flex-start; }
  .module-num { width: 36px; height: 36px; border-radius: 50%; background: var(--brand-primary, #2563eb); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; flex-shrink: 0; }
  .module-item h3 { font-size: 1.05rem; margin-bottom: 0.25rem; }
  .module-item p { font-size: 0.9rem; color: #6b7280; }
  .instructor { display: flex; gap: 2.5rem; padding: 5rem 1.5rem; max-width: 700px; margin: 0 auto; align-items: center; }
  .instructor-photo { width: 140px; height: 140px; border-radius: 16px; background: linear-gradient(135deg, var(--brand-primary, #2563eb), var(--brand-secondary, #1e40af)); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 3rem; font-weight: 700; }
  .instructor-info h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: 1.5rem; margin-bottom: 0.25rem; }
  .instructor-info .title { color: var(--brand-primary, #2563eb); font-weight: 600; margin-bottom: 0.75rem; }
  .instructor-info p { color: #4b5563; line-height: 1.6; }
  .enroll-cta { padding: 5rem 1.5rem; text-align: center; background: linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, var(--brand-secondary, #1e40af) 100%); color: #fff; }
  .enroll-cta h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.75rem, 4vw, 2.75rem); margin-bottom: 0.75rem; }
  .enroll-cta p { font-size: 1.1rem; opacity: 0.9; margin-bottom: 2rem; }
  .enroll-cta .cta-btn { background: var(--brand-accent, #f59e0b); color: #111; }
  @media (max-width: 640px) { .instructor { flex-direction: column; text-align: center; } .stats-bar { gap: 1.5rem; } }
</style>

<section class="course-hero">
  <span class="tag">Online Course</span>
  <h1>Course Name: The Transformation You Promise</h1>
  <p>A compelling description of who this course is for and what they''ll achieve by the end.</p>
  <a href="#enroll" class="cta-btn">Enroll Now →</a>
</section>

<div class="stats-bar">
  <div class="stat"><div class="num">X+</div><div class="desc">Students enrolled</div></div>
  <div class="stat"><div class="num">X</div><div class="desc">Video lessons</div></div>
  <div class="stat"><div class="num">X hrs</div><div class="desc">Of content</div></div>
  <div class="stat"><div class="num">4.9★</div><div class="desc">Average rating</div></div>
</div>

<section class="modules">
  <h2>What''s Inside</h2>
  <div class="module-item"><div class="module-num">1</div><div><h3>Module One Title</h3><p>Brief description of what this module covers and the outcome.</p></div></div>
  <div class="module-item"><div class="module-num">2</div><div><h3>Module Two Title</h3><p>Brief description of what this module covers and the outcome.</p></div></div>
  <div class="module-item"><div class="module-num">3</div><div><h3>Module Three Title</h3><p>Brief description of what this module covers and the outcome.</p></div></div>
  <div class="module-item"><div class="module-num">4</div><div><h3>Module Four Title</h3><p>Brief description of what this module covers and the outcome.</p></div></div>
  <div class="module-item"><div class="module-num">5</div><div><h3>Module Five Title</h3><p>Brief description of what this module covers and the outcome.</p></div></div>
</section>

<section class="instructor">
  <div class="instructor-photo">YN</div>
  <div class="instructor-info">
    <h2>Your Name</h2>
    <div class="title">Your Title</div>
    <p>Your bio — establish credibility, share your journey, and connect with your audience. Focus on why you''re uniquely qualified to teach this material.</p>
  </div>
</section>

<section id="enroll" class="enroll-cta">
  <h2>Start your journey today</h2>
  <p>Join X+ students who''ve already transformed their [skill/career/life].</p>
  <a href="/api/checkout?product=PRODUCT_ID" class="cta-btn">Enroll Now — $XX →</a>
</section>'
);

-- 5. About/Bio Page
INSERT INTO public.page_templates (name, category, description, design_notes, html_content) VALUES (
  'About / Bio Page',
  'about',
  'Personal brand page with story section, credentials, featured work, and contact CTA. Great for building trust and authority.',
  'This is the most personal template — encourage the user to share their real story. The credentials section should highlight genuine expertise. Featured work can link to blog posts, case studies, or external press. Keep the tone authentic to the user''s voice.',
  '<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--brand-font-body, system-ui, -apple-system, sans-serif); color: var(--brand-text, #111827); background: var(--brand-background, #ffffff); }
  .about-hero { padding: 6rem 1.5rem; display: flex; gap: 3rem; max-width: 900px; margin: 0 auto; align-items: center; }
  .about-photo { width: 220px; height: 220px; border-radius: 24px; background: linear-gradient(135deg, var(--brand-primary, #2563eb), var(--brand-accent, #f59e0b)); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 4rem; font-weight: 700; }
  .about-intro h1 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(2rem, 4vw, 3rem); line-height: 1.15; margin-bottom: 0.5rem; }
  .about-intro .tagline { font-size: 1.2rem; color: var(--brand-primary, #2563eb); font-weight: 600; margin-bottom: 1.25rem; }
  .about-intro p { font-size: 1.05rem; line-height: 1.7; color: #4b5563; }
  .story { padding: 4rem 1.5rem; max-width: 700px; margin: 0 auto; }
  .story h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2rem); margin-bottom: 1.5rem; }
  .story p { font-size: 1.05rem; line-height: 1.8; color: #374151; margin-bottom: 1.25rem; }
  .credentials { padding: 4rem 1.5rem; background: #f9fafb; }
  .credentials-inner { max-width: 800px; margin: 0 auto; }
  .credentials h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2rem); margin-bottom: 2rem; text-align: center; }
  .cred-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
  .cred-item { text-align: center; padding: 1.5rem; background: #fff; border-radius: 12px; }
  .cred-item .number { font-family: var(--brand-font-heading, Georgia, serif); font-size: 2.25rem; font-weight: 700; color: var(--brand-primary, #2563eb); }
  .cred-item .desc { font-size: 0.9rem; color: #6b7280; margin-top: 0.25rem; }
  .featured { padding: 4rem 1.5rem; max-width: 800px; margin: 0 auto; }
  .featured h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2rem); margin-bottom: 2rem; text-align: center; }
  .featured-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; }
  .featured-card { border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .featured-card .card-body { padding: 1.25rem; }
  .featured-card h3 { font-size: 1rem; margin-bottom: 0.375rem; }
  .featured-card p { font-size: 0.9rem; color: #6b7280; }
  .featured-card a { display: inline-block; margin-top: 0.75rem; color: var(--brand-primary, #2563eb); font-weight: 600; text-decoration: none; font-size: 0.9rem; }
  .contact-cta { padding: 5rem 1.5rem; text-align: center; }
  .contact-cta h2 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(1.5rem, 3vw, 2.25rem); margin-bottom: 0.75rem; }
  .contact-cta p { color: #4b5563; margin-bottom: 2rem; font-size: 1.05rem; }
  .contact-cta a { display: inline-block; padding: 1rem 2.5rem; background: var(--brand-primary, #2563eb); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1.05rem; }
  @media (max-width: 640px) { .about-hero { flex-direction: column; text-align: center; padding: 3rem 1rem; } }
</style>

<section class="about-hero">
  <div class="about-photo">YN</div>
  <div class="about-intro">
    <h1>Hi, I''m [Your Name]</h1>
    <div class="tagline">Your one-line positioning statement</div>
    <p>A brief, warm introduction. Who are you, what do you do, and who do you help? Write this like you''re meeting someone at a coffee shop — natural, not corporate.</p>
  </div>
</section>

<section class="story">
  <h2>My story</h2>
  <p>Start with where you were — the challenge, the frustration, the moment that changed everything. People connect with authentic stories, not polished resumes.</p>
  <p>Share the turning point — what you discovered, built, or learned that led you to where you are today. Be specific about the transformation.</p>
  <p>End with your mission — why you do what you do now, and what drives you to help your audience achieve their goals.</p>
</section>

<section class="credentials">
  <div class="credentials-inner">
    <h2>By the numbers</h2>
    <div class="cred-grid">
      <div class="cred-item"><div class="number">X+</div><div class="desc">Students or clients helped</div></div>
      <div class="cred-item"><div class="number">X</div><div class="desc">Years of experience</div></div>
      <div class="cred-item"><div class="number">X+</div><div class="desc">Resources published</div></div>
      <div class="cred-item"><div class="number">X</div><div class="desc">Countries reached</div></div>
    </div>
  </div>
</section>

<section class="featured">
  <h2>Featured work</h2>
  <div class="featured-grid">
    <div class="featured-card"><div class="card-body"><h3>Project or Article</h3><p>Brief description of this work and its impact.</p><a href="#">Read more →</a></div></div>
    <div class="featured-card"><div class="card-body"><h3>Project or Article</h3><p>Brief description of this work and its impact.</p><a href="#">Read more →</a></div></div>
    <div class="featured-card"><div class="card-body"><h3>Project or Article</h3><p>Brief description of this work and its impact.</p><a href="#">Read more →</a></div></div>
  </div>
</section>

<section class="contact-cta">
  <h2>Let''s connect</h2>
  <p>Whether you have a question, want to collaborate, or just want to say hi — I''d love to hear from you.</p>
  <a href="mailto:hello@yourdomain.com">Get in Touch →</a>
</section>'
);

-- 6. Waitlist / Coming Soon
INSERT INTO public.page_templates (name, category, description, design_notes, html_content) VALUES (
  'Waitlist / Coming Soon',
  'waitlist',
  'Minimal, high-impact coming soon page with teaser headline, email capture, and optional countdown. Perfect for building anticipation before a launch.',
  'This template is intentionally minimal — less is more for a waitlist page. The countdown is optional; remove it if there''s no fixed date. The background gradient creates visual interest without needing images. Consider adding a "sneak peek" section if you have preview content.',
  '<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--brand-font-body, system-ui, -apple-system, sans-serif); color: #fff; background: linear-gradient(135deg, var(--brand-primary, #2563eb) 0%, var(--brand-secondary, #1e40af) 60%, #0f172a 100%); min-height: 100vh; }
  .waitlist { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1.5rem; text-align: center; }
  .waitlist .badge { display: inline-block; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); padding: 0.375rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.2); }
  .waitlist h1 { font-family: var(--brand-font-heading, Georgia, serif); font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 1.08; margin-bottom: 1.25rem; max-width: 700px; }
  .waitlist p { font-size: clamp(1rem, 2.5vw, 1.25rem); opacity: 0.85; max-width: 500px; margin-bottom: 2.5rem; line-height: 1.6; }
  .waitlist-form { display: flex; gap: 0.75rem; max-width: 440px; width: 100%; }
  .waitlist-form input { flex: 1; padding: 0.875rem 1rem; border: none; border-radius: 8px; font-size: 1rem; background: rgba(255,255,255,0.95); color: #111; }
  .waitlist-form button { padding: 0.875rem 1.75rem; background: var(--brand-accent, #f59e0b); color: #111; border: none; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; white-space: nowrap; transition: transform 0.15s; }
  .waitlist-form button:hover { transform: translateY(-1px); }
  .countdown { display: flex; gap: 1.5rem; margin-bottom: 3rem; }
  .countdown-unit { text-align: center; }
  .countdown-unit .num { font-size: 2.5rem; font-weight: 700; display: block; font-family: var(--brand-font-heading, Georgia, serif); }
  .countdown-unit .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.6; }
  .footer-note { position: absolute; bottom: 2rem; font-size: 0.8rem; opacity: 0.5; }
  @media (max-width: 640px) { .waitlist-form { flex-direction: column; } .countdown .num { font-size: 1.75rem; } }
</style>

<section class="waitlist">
  <span class="badge">Coming Soon</span>
  <h1>Something extraordinary is on the way</h1>
  <p>A short, intriguing description of what''s coming. Create anticipation without giving everything away.</p>
  <div class="countdown" id="countdown">
    <div class="countdown-unit"><span class="num" id="cd-days">00</span><span class="label">Days</span></div>
    <div class="countdown-unit"><span class="num" id="cd-hours">00</span><span class="label">Hours</span></div>
    <div class="countdown-unit"><span class="num" id="cd-mins">00</span><span class="label">Minutes</span></div>
    <div class="countdown-unit"><span class="num" id="cd-secs">00</span><span class="label">Seconds</span></div>
  </div>
  <form class="waitlist-form" action="/api/leads/capture" method="POST">
    <input type="email" name="email" placeholder="Enter your email" required>
    <input type="hidden" name="source" value="waitlist">
    <button type="submit">Join the Waitlist</button>
  </form>
</section>

<script>
(function() {
  var target = new Date("2025-12-31T18:00:00Z").getTime();
  function tick() {
    var now = Date.now(), d = target - now;
    if (d < 0) { document.getElementById("countdown").style.display = "none"; return; }
    document.getElementById("cd-days").textContent = String(Math.floor(d/86400000)).padStart(2,"0");
    document.getElementById("cd-hours").textContent = String(Math.floor((d%86400000)/3600000)).padStart(2,"0");
    document.getElementById("cd-mins").textContent = String(Math.floor((d%3600000)/60000)).padStart(2,"0");
    document.getElementById("cd-secs").textContent = String(Math.floor((d%60000)/1000)).padStart(2,"0");
  }
  tick(); setInterval(tick, 1000);
})();
</script>'
);
