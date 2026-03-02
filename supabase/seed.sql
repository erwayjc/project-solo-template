-- =============================================================================
-- Seed Data — AI Solo Starter Kit
-- =============================================================================
-- Populates all tables with realistic sample data so the app is immediately
-- usable after migration. Every INSERT uses ON CONFLICT DO NOTHING or targets
-- tables that will be empty, making this script safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- site_config (id=1 already inserted by 00001_core_auth migration)
-- ---------------------------------------------------------------------------
update public.site_config
set
  site_name           = 'My Business',
  tagline             = 'Powered by AI',
  brand_colors        = '{"primary": "#2563eb", "secondary": "#1e40af", "accent": "#f59e0b", "background": "#ffffff", "text": "#111827"}'::jsonb,
  social_links        = '{}'::jsonb,
  seo_defaults        = '{"title": "My Business", "description": "Powered by AI", "og_image": "", "keywords": ""}'::jsonb,
  master_context      = '',
  setup_complete      = false
where id = 1;

-- ---------------------------------------------------------------------------
-- Products (2 sample products)
-- ---------------------------------------------------------------------------
-- These reference the products table created in a prior migration (00002–00005).

insert into public.products (id, name, description, price_amount, currency, price_type, subscription_interval, stripe_price_id, features, is_active, sort_order)
values
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Online Course',
    'Complete online course with lifetime access to all modules, community, and certificate of completion.',
    29700,
    'usd',
    'one_time',
    null,
    '',
    '["Lifetime access", "All modules", "Community access", "Certificate"]'::jsonb,
    true,
    1
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Monthly Membership',
    'All-access monthly membership including course content, live Q&A calls, community, and new content every month.',
    4700,
    'usd',
    'subscription',
    'month',
    '',
    '["All course content", "Monthly Q&A calls", "Community access", "New content monthly"]'::jsonb,
    true,
    2
  );

-- ---------------------------------------------------------------------------
-- Modules (2 sample modules)
-- ---------------------------------------------------------------------------
insert into public.modules (id, product_id, title, description, sort_order, is_published)
values
  (
    'b1b2c3d4-0001-4000-8000-000000000001',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Getting Started',
    'Everything you need to know to hit the ground running. Covers setup, core concepts, and your first quick win.',
    1,
    true
  ),
  (
    'b1b2c3d4-0002-4000-8000-000000000002',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Advanced Strategies',
    'Deep dives into advanced techniques, optimization, and scaling strategies for serious growth.',
    2,
    false
  );

-- ---------------------------------------------------------------------------
-- Lessons (4 total — 2 per module)
-- ---------------------------------------------------------------------------
insert into public.lessons (id, module_id, title, content, video_url, downloads, sort_order, is_published)
values
  (
    'c1b2c3d4-0001-4000-8000-000000000001',
    'b1b2c3d4-0001-4000-8000-000000000001',
    'Welcome & Overview',
    E'# Welcome to the Course!\n\nWe''re thrilled to have you here. In this lesson, we''ll cover:\n\n- What you''ll learn in this course\n- How to get the most out of each module\n- Your first quick win assignment\n\n## What to Expect\n\nThis course is designed for action-takers. Each lesson includes practical exercises you can implement immediately.\n\n## Your First Assignment\n\nIntroduce yourself in the community and share one goal you want to achieve by the end of this course.',
    '',
    '[]'::jsonb,
    1,
    true
  ),
  (
    'c1b2c3d4-0002-4000-8000-000000000002',
    'b1b2c3d4-0001-4000-8000-000000000001',
    'Setting Up Your Foundation',
    E'# Setting Up Your Foundation\n\nBefore we dive into the strategies, we need to make sure your foundation is solid.\n\n## Step 1: Define Your Target Audience\n\nWho are you trying to reach? Be specific.\n\n## Step 2: Clarify Your Value Proposition\n\nWhat unique value do you provide that nobody else does?\n\n## Step 3: Set Up Your Tools\n\nFollow the checklist below to ensure all your tools are configured and ready.\n\n## Checklist\n\n- [ ] Profile completed\n- [ ] Tools connected\n- [ ] First draft written',
    '',
    '[]'::jsonb,
    2,
    true
  ),
  (
    'c1b2c3d4-0003-4000-8000-000000000003',
    'b1b2c3d4-0002-4000-8000-000000000002',
    'Scaling With Systems',
    E'# Scaling With Systems\n\nNow that you have the basics down, it''s time to build systems that scale.\n\n## The Automation Framework\n\nWe''ll cover the three pillars of sustainable scaling:\n\n1. **Repeatable processes** — Document what works\n2. **Automation** — Remove yourself from repetitive tasks\n3. **Delegation** — Know when AI handles it vs. when you step in\n\n## Exercise\n\nMap out your top 5 recurring tasks and categorize each as automate, delegate, or keep.',
    '',
    '[]'::jsonb,
    1,
    false
  ),
  (
    'c1b2c3d4-0004-4000-8000-000000000004',
    'b1b2c3d4-0002-4000-8000-000000000002',
    'Advanced Growth Tactics',
    E'# Advanced Growth Tactics\n\nThis lesson covers the growth strategies that separate hobbyists from real businesses.\n\n## Content Multiplication\n\nOne piece of content becomes ten. Here''s the framework:\n\n- Blog post -> Social posts -> Email -> Video script -> Podcast talking points\n\n## Strategic Partnerships\n\nFind complementary businesses and create win-win collaborations.\n\n## Paid Amplification\n\nWhen and how to put budget behind your best-performing organic content.',
    '',
    '[]'::jsonb,
    2,
    false
  );

-- ---------------------------------------------------------------------------
-- Pages (6 sample pages)
-- ---------------------------------------------------------------------------
insert into public.pages (id, slug, sections, seo, is_published)
values
  (
    'd1b2c3d4-0001-4000-8000-000000000001',
    'home',
    '[
      {
        "type": "hero",
        "order": 1,
        "headline": "Build Your Dream Business — Powered by AI",
        "body": "Everything you need to launch, grow, and run a profitable one-person business. No code required.",
        "cta": {"text": "Get Started Free", "url": "/opt-in"},
        "image": ""
      },
      {
        "type": "benefits",
        "order": 2,
        "headline": "Why Choose Us",
        "items": [
          {"title": "AI-Powered", "description": "Your own AI team handles marketing, support, and content creation."},
          {"title": "All-In-One", "description": "Course delivery, email marketing, sales funnels, and CRM in one platform."},
          {"title": "Launch Fast", "description": "Go from zero to live business in under a week — no technical skills needed."}
        ]
      },
      {
        "type": "testimonials",
        "order": 3,
        "headline": "What Our Students Say",
        "items": [
          {"name": "Alex R.", "quote": "I launched my entire business in a weekend. The AI agents handle things I used to spend hours on.", "role": "Course Creator"},
          {"name": "Jordan M.", "quote": "The email sequences and content engine run on autopilot. I focus on what I love — teaching.", "role": "Coach"}
        ]
      },
      {
        "type": "cta",
        "order": 4,
        "headline": "Ready to Start?",
        "body": "Join hundreds of solopreneurs who are building smarter, not harder.",
        "cta": {"text": "Start Building Today", "url": "/opt-in"}
      }
    ]'::jsonb,
    '{"title": "Home | My Business", "description": "Build your dream business powered by AI.", "og_image": ""}'::jsonb,
    true
  ),
  (
    'd1b2c3d4-0002-4000-8000-000000000002',
    'sales',
    '[
      {
        "type": "headline",
        "order": 1,
        "headline": "The Complete System to Build a One-Person Business With AI",
        "body": "Stop piecing together tools. Stop guessing what to do next. Get the exact system, templates, and AI team you need to launch and grow."
      },
      {
        "type": "offer_stack",
        "order": 2,
        "headline": "Everything You Get",
        "items": [
          {"title": "Complete Course Library", "value": "$997 value", "description": "Step-by-step modules covering every aspect of building your business."},
          {"title": "AI Agent Team", "value": "$497 value", "description": "Pre-built AI agents for content, sales, email, and support — ready to work for you."},
          {"title": "Sales Funnel Templates", "value": "$297 value", "description": "Proven landing pages, opt-in forms, and checkout flows you can customize in minutes."},
          {"title": "Email Sequence Library", "value": "$197 value", "description": "Welcome series, nurture sequences, and broadcast templates that convert."},
          {"title": "Private Community Access", "value": "Priceless", "description": "Connect with other solopreneurs, get feedback, and stay accountable."}
        ]
      },
      {
        "type": "testimonials",
        "order": 3,
        "headline": "Success Stories",
        "items": [
          {"name": "Sam K.", "quote": "Within 30 days I had my first paying customers. The AI agents saved me at least 20 hours a week.", "role": "Consultant"},
          {"name": "Taylor P.", "quote": "I tried building a business twice before and gave up. This time, everything just worked.", "role": "Freelancer"}
        ]
      },
      {
        "type": "cta",
        "order": 4,
        "headline": "Get Instant Access",
        "body": "One-time payment. Lifetime access. Zero risk with our 30-day guarantee.",
        "cta": {"text": "Enroll Now — $297", "url": "/checkout"}
      }
    ]'::jsonb,
    '{"title": "Enroll | My Business", "description": "Get the complete system to build your AI-powered business.", "og_image": ""}'::jsonb,
    true
  ),
  (
    'd1b2c3d4-0003-4000-8000-000000000003',
    'opt-in',
    '[
      {
        "type": "headline",
        "order": 1,
        "headline": "Free Guide: 5 AI Shortcuts to Launch Your Business This Week",
        "body": "Download the free guide and discover how solopreneurs are using AI to build profitable businesses in days, not months."
      },
      {
        "type": "form",
        "order": 2,
        "fields": ["name", "email"],
        "cta": {"text": "Send Me the Guide", "url": "/api/opt-in"},
        "privacy_note": "No spam. Unsubscribe anytime."
      },
      {
        "type": "benefits",
        "order": 3,
        "headline": "Inside the Free Guide",
        "items": [
          {"title": "Shortcut #1", "description": "How to set up your entire sales funnel in one afternoon."},
          {"title": "Shortcut #2", "description": "The AI email sequence that nurtures leads while you sleep."},
          {"title": "Shortcut #3", "description": "A content multiplication framework that turns one idea into 10 posts."},
          {"title": "Shortcut #4", "description": "The support automation that handles 80% of customer questions instantly."},
          {"title": "Shortcut #5", "description": "A weekly AI briefing that tells you exactly what to focus on next."}
        ]
      }
    ]'::jsonb,
    '{"title": "Free Guide | My Business", "description": "Download the free guide to launching your AI-powered business.", "og_image": ""}'::jsonb,
    true
  ),
  (
    'd1b2c3d4-0004-4000-8000-000000000004',
    'thank-you',
    '[
      {
        "type": "confirmation",
        "order": 1,
        "headline": "You''re In! Check Your Email",
        "body": "We just sent the guide to your inbox. If you don''t see it in the next few minutes, check your spam folder and mark us as safe."
      },
      {
        "type": "download",
        "order": 2,
        "headline": "Can''t Wait? Download Now",
        "body": "Click below to download the guide immediately.",
        "cta": {"text": "Download the Guide", "url": "#"},
        "note": "You''ll also receive it by email for future reference."
      }
    ]'::jsonb,
    '{"title": "Thank You | My Business", "description": "Your download is ready.", "og_image": ""}'::jsonb,
    true
  ),
  (
    'd1b2c3d4-0005-4000-8000-000000000005',
    'privacy-policy',
    '[
      {
        "type": "legal",
        "order": 1,
        "headline": "Privacy Policy",
        "body": "Last updated: {{current_date}}\n\n{{site_name}} (\"we\", \"us\", or \"our\") operates the {{site_name}} website. This page informs you of our policies regarding the collection, use, and disclosure of personal information when you use our service.\n\n## Information We Collect\n\nWe collect the following types of information:\n\n- **Account Information**: When you create an account, we collect your name and email address.\n- **Payment Information**: Payment processing is handled by Stripe. We do not store your credit card details.\n- **Usage Data**: We collect information about how you interact with our platform, including lessons viewed and features used.\n- **Communication Data**: When you contact support or opt in to our email list, we store your messages and email address.\n\n## How We Use Your Information\n\n- To provide and maintain our service\n- To send you course updates, emails you opted into, and support responses\n- To process payments through Stripe\n- To improve our platform based on usage patterns\n\n## Data Sharing\n\nWe do not sell your personal information. We share data only with:\n\n- **Stripe** — for payment processing\n- **Resend** — for email delivery\n- **Vercel** — for hosting\n- **Supabase** — for data storage and authentication\n\n## Your Rights\n\nYou may request access to, correction of, or deletion of your personal data at any time by contacting us at {{legal_contact_email}}.\n\n## Contact\n\nFor privacy-related questions, contact us at {{legal_contact_email}}."
      }
    ]'::jsonb,
    '{"title": "Privacy Policy | My Business", "description": "Our privacy policy.", "og_image": ""}'::jsonb,
    true
  ),
  (
    'd1b2c3d4-0006-4000-8000-000000000006',
    'terms-of-service',
    '[
      {
        "type": "legal",
        "order": 1,
        "headline": "Terms of Service",
        "body": "Last updated: {{current_date}}\n\nWelcome to {{site_name}}. By accessing or using our platform, you agree to be bound by these terms.\n\n## 1. Acceptance of Terms\n\nBy creating an account or using {{site_name}}, you agree to these Terms of Service and our Privacy Policy.\n\n## 2. Account Responsibilities\n\n- You must provide accurate information when creating your account.\n- You are responsible for maintaining the security of your account credentials.\n- You must be at least 18 years old to use this service.\n\n## 3. Payments and Refunds\n\n- All payments are processed securely through Stripe.\n- One-time purchases include a 30-day money-back guarantee.\n- Subscription plans may be cancelled at any time. Refunds for partial billing periods are not provided.\n\n## 4. Intellectual Property\n\n- All course content, materials, and platform code are the intellectual property of {{site_name}}.\n- You are granted a personal, non-transferable license to access purchased content.\n- You may not redistribute, resell, or share course materials.\n\n## 5. Acceptable Use\n\nYou agree not to:\n- Share your account credentials with others\n- Attempt to reverse-engineer or copy the platform\n- Use the platform for any unlawful purpose\n\n## 6. Limitation of Liability\n\n{{site_name}} is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.\n\n## 7. Modifications\n\nWe reserve the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance.\n\n## 8. Contact\n\nFor questions about these terms, contact us at {{legal_contact_email}}."
      }
    ]'::jsonb,
    '{"title": "Terms of Service | My Business", "description": "Our terms of service.", "og_image": ""}'::jsonb,
    true
  );

-- ---------------------------------------------------------------------------
-- Email Sequence: Welcome Series (3 steps)
-- ---------------------------------------------------------------------------
insert into public.email_sequences (id, name, trigger, is_active)
values (
  'e1b2c3d4-0001-4000-8000-000000000001',
  'Welcome Series',
  'opt_in',
  true
);

insert into public.email_sequence_steps (id, sequence_id, step_number, subject, body, delay_hours)
values
  (
    'f1b2c3d4-0001-4000-8000-000000000001',
    'e1b2c3d4-0001-4000-8000-000000000001',
    1,
    'Welcome! Here''s your free guide',
    E'Hi {{name}},\n\nThanks for downloading the guide! Here''s your link:\n\n[Download the Guide]({{download_url}})\n\nInside you''ll find 5 practical AI shortcuts you can start using today to build your business faster.\n\nI''d love to hear which shortcut you try first — just reply to this email.\n\nTalk soon,\n{{site_name}}',
    0
  ),
  (
    'f1b2c3d4-0002-4000-8000-000000000002',
    'e1b2c3d4-0001-4000-8000-000000000001',
    2,
    'The #1 mistake new solopreneurs make',
    E'Hi {{name}},\n\nI see it all the time: new solopreneurs spend weeks picking the "perfect" tools, designing logos, and planning instead of launching.\n\nThe truth? Your first version doesn''t need to be perfect. It needs to exist.\n\nHere''s what I recommend:\n\n1. Pick ONE offer (course, service, or product)\n2. Write ONE landing page\n3. Tell ONE audience about it\n4. Iterate based on real feedback\n\nThat''s it. Everything else is noise until you have paying customers.\n\nReady to take the leap? Reply and tell me what you''re building.\n\n{{site_name}}',
    24
  ),
  (
    'f1b2c3d4-0003-4000-8000-000000000003',
    'e1b2c3d4-0001-4000-8000-000000000001',
    3,
    'A faster way to build your business',
    E'Hi {{name}},\n\nOver the past couple of days I''ve shared some strategies for getting started. Now I want to show you the complete system.\n\nThe AI Solo Starter Kit gives you:\n\n- A complete course platform to deliver your product\n- AI agents that handle content, email, sales, and support\n- Pre-built sales funnels and email sequences\n- Everything running from one dashboard\n\nHundreds of solopreneurs are already using it to build real businesses.\n\n[See what''s included]({{sales_url}})\n\nIf you have any questions, just reply. I read every email.\n\n{{site_name}}',
    72
  );

-- ---------------------------------------------------------------------------
-- Agents (6 pre-built agents)
-- ---------------------------------------------------------------------------
insert into public.agents (id, name, slug, description, system_prompt, tools, mcp_servers, data_access, icon, is_system, is_active)
values
  (
    '11111111-0001-4000-8000-000000000001',
    'Dev Agent',
    'dev-agent',
    'Your AI developer and business manager. Has access to all tools and all data. This is your primary interface for running your business.',
    E'You are the Dev Agent — the user''s AI developer and business manager.\nYou have access to ALL tools and ALL database tables.\nAlways confirm destructive actions before executing.\nUse the Master Context Document from site_config to understand the business.\nBe proactive: suggest improvements, flag issues, and anticipate needs.\nKeep responses practical and action-oriented.\nWhen unsure, ask clarifying questions rather than guessing.\nFormat responses with clear structure: headings, bullets, code blocks as needed.\n-- Full system prompt loaded from agents/prompts/dev-agent.ts at runtime --',
    '{update_site_config,update_page_content,upload_file,create_module,update_module,create_lesson,update_lesson,delete_lesson,get_course_structure,create_email_sequence,update_email_sequence,create_broadcast,send_broadcast,get_email_stats,get_leads,update_lead_status,get_customers,get_revenue_stats,create_blog_post,update_blog_post,create_social_content,approve_social_content,get_content_calendar,get_support_tickets,respond_to_ticket,resolve_ticket,create_agent,update_agent,delete_agent,list_agents,get_dashboard_summary,get_analytics,generate_weekly_briefing}',
    '{internal,supabase,stripe}',
    '{profiles,site_config,products,modules,lessons,lesson_progress,leads,pages,email_sequences,email_sequence_steps,email_sends,broadcasts,blog_posts,content_queue,support_tickets,agents,agent_conversations,announcements,media,mcp_connections}',
    '🛠️',
    true,
    true
  ),
  (
    '11111111-0002-4000-8000-000000000002',
    'Content Director',
    'content-director',
    'Plans content strategy, generates content calendar, drafts blog posts, and creates social media content across platforms.',
    E'You are the Content Director — an AI content strategist and writer.\nYour job is to plan, create, and optimize content across blog and social channels.\nUse the Master Context Document for voice, tone, and audience understanding.\nAlways think in terms of content strategy: what serves the audience AND the business.\nRepurpose content across formats: blog -> social -> email.\nTrack performance and adjust strategy based on what resonates.\nSuggest content ideas proactively based on trends and audience interests.\n-- Full system prompt loaded from agents/prompts/content-director.ts at runtime --',
    '{create_blog_post,update_blog_post,create_social_content,get_content_calendar,get_analytics}',
    '{internal}',
    '{blog_posts,content_queue,site_config}',
    '📝',
    false,
    true
  ),
  (
    '11111111-0003-4000-8000-000000000003',
    'Sales Strategist',
    'sales-strategist',
    'Reviews lead pipeline, suggests follow-up actions, analyzes conversion data, and recommends offer optimizations.',
    E'You are the Sales Strategist — an AI sales analyst and advisor.\nYour job is to maximize revenue by optimizing the sales pipeline and conversion rates.\nAnalyze lead data, identify patterns, and suggest actionable follow-ups.\nReview conversion metrics and recommend offer, pricing, or funnel improvements.\nAlways tie recommendations to specific data points.\nBe direct about what is and is not working.\nPrioritize high-impact, low-effort optimizations first.\n-- Full system prompt loaded from agents/prompts/sales-strategist.ts at runtime --',
    '{get_leads,update_lead_status,get_revenue_stats,get_email_stats,get_analytics}',
    '{internal}',
    '{leads,email_sends,email_sequences,profiles}',
    '📈',
    false,
    true
  ),
  (
    '11111111-0004-4000-8000-000000000004',
    'Customer Success Manager',
    'customer-success',
    'Monitors customer engagement, handles support escalations, identifies at-risk accounts, and suggests retention strategies.',
    E'You are the Customer Success Manager — an AI engagement and retention specialist.\nYour job is to ensure customers are successful, engaged, and retained.\nMonitor course progress, support interactions, and engagement signals.\nIdentify at-risk customers early and suggest proactive outreach.\nReview escalated support tickets and draft thoughtful responses.\nAlways prioritize the customer experience while protecting business interests.\nSuggest retention strategies backed by engagement data.\n-- Full system prompt loaded from agents/prompts/customer-success.ts at runtime --',
    '{get_customers,get_support_tickets,respond_to_ticket,create_email_sequence,get_analytics}',
    '{internal}',
    '{profiles,support_tickets,lesson_progress,email_sends}',
    '🤝',
    false,
    true
  ),
  (
    '11111111-0005-4000-8000-000000000005',
    'Email Copywriter',
    'email-copywriter',
    'Writes email sequences, broadcast emails, and one-off emails. Optimizes subject lines, CTAs, and send timing.',
    E'You are the Email Copywriter — an AI email marketing specialist.\nYour job is to write high-converting emails that sound human and authentic.\nUse the Master Context Document for voice, tone, and brand personality.\nWrite compelling subject lines that drive opens without being clickbait.\nStructure emails for scannability: short paragraphs, clear CTAs, personal tone.\nOptimize send timing based on audience engagement patterns.\nA/B test suggestions should always be specific and measurable.\n-- Full system prompt loaded from agents/prompts/email-copywriter.ts at runtime --',
    '{create_email_sequence,update_email_sequence,create_broadcast,get_email_stats}',
    '{internal}',
    '{email_sequences,email_sequence_steps,broadcasts,email_sends,site_config}',
    '✉️',
    false,
    true
  ),
  (
    '11111111-0006-4000-8000-000000000006',
    'Support Agent',
    'support-agent',
    'Customer-facing support agent. Responds to questions using product knowledge base. Escalates complex issues to the admin.',
    E'You are the Support Agent — a friendly, helpful AI support representative.\nYou are CUSTOMER-FACING. Only share product information and help with course-related questions.\nNEVER expose business data, revenue, leads, or internal metrics.\nNEVER mention other AI agents, the admin dashboard, or internal systems.\nUse course content (modules, lessons) to answer product questions.\nIf you cannot confidently answer, escalate to a human by setting status to escalated.\nBe warm, empathetic, and concise. Resolve issues on the first response when possible.\n-- Full system prompt loaded from agents/prompts/support-agent.ts at runtime --',
    '{respond_to_ticket,resolve_ticket,get_course_structure}',
    '{internal}',
    '{support_tickets,lessons,modules,site_config}',
    '💬',
    false,
    true
  );

-- ---------------------------------------------------------------------------
-- MCP Connections (3 system connections)
-- ---------------------------------------------------------------------------
insert into public.mcp_connections (id, name, slug, transport, url, auth_type, credentials_encrypted, is_system, is_active)
values
  (
    '22222222-0001-4000-8000-000000000001',
    'Internal Tools',
    'internal',
    'in_process',
    null,
    'none',
    null,
    true,
    true
  ),
  (
    '22222222-0002-4000-8000-000000000002',
    'Supabase',
    'supabase',
    'in_process',
    null,
    'none',
    null,
    true,
    true
  ),
  (
    '22222222-0003-4000-8000-000000000003',
    'Stripe',
    'stripe',
    'streamable_http',
    'https://mcp.stripe.com',
    'oauth',
    null,
    true,
    true
  );

-- ---------------------------------------------------------------------------
-- Blog Post (1 sample published post)
-- ---------------------------------------------------------------------------
insert into public.blog_posts (id, title, slug, content, excerpt, featured_image, tags, seo, status, published_at)
values (
  'g1b2c3d4-0001-4000-8000-000000000001',
  'Welcome to Our Blog',
  'welcome',
  E'# Welcome to Our Blog\n\nWe''re excited to launch our blog! This is where we''ll share insights, tips, and strategies to help you build a successful one-person business.\n\n## What to Expect\n\nHere''s what we''ll be covering:\n\n### Practical Tutorials\nStep-by-step guides you can follow and implement immediately. No fluff, no theory without application.\n\n### Industry Insights\nWhat''s working right now in the world of solopreneurship, AI-powered business, and digital products.\n\n### Behind the Scenes\nHonest looks at what we''re building, what''s working, and what we''re learning along the way.\n\n### Student Spotlights\nReal stories from people in our community who are building incredible businesses.\n\n## Stay Connected\n\nThe best way to stay updated is to [join our email list](/opt-in). We send a weekly digest of new posts plus exclusive content you won''t find on the blog.\n\nHave a topic you''d like us to cover? Let us know in the comments or reach out through our [support page](/portal/support).\n\nHere''s to building something great together.',
  'We''re excited to launch our blog! Here''s what to expect: practical tutorials, industry insights, behind-the-scenes looks, and student spotlights.',
  '',
  '{welcome, announcement, getting-started}',
  '{"meta_title": "Welcome to Our Blog | My Business", "meta_description": "We''re launching our blog! Expect practical tutorials, industry insights, and real stories from solopreneurs building AI-powered businesses.", "keywords": "solopreneur, AI business, blog launch"}'::jsonb,
  'published',
  now()
);

-- ---------------------------------------------------------------------------
-- Announcement (1 sample welcome announcement)
-- ---------------------------------------------------------------------------
insert into public.announcements (id, title, content, type, is_published, published_at)
values (
  'h1b2c3d4-0001-4000-8000-000000000001',
  'Welcome!',
  'Welcome to the platform! We''re glad you''re here. Explore the course modules to get started, and don''t hesitate to reach out to support if you need anything.',
  'info',
  true,
  now()
);
