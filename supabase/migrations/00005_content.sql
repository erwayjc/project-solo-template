-- =============================================================================
-- Migration 00005: Content — blog_posts & content_queue
-- =============================================================================
-- Blog / article publishing and a social-media content queue for scheduling
-- posts across platforms.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: blog_posts
-- Long-form content (articles, tutorials, announcements). Supports draft /
-- published / archived workflow, SEO metadata, and tag-based filtering.
-- ---------------------------------------------------------------------------
create table public.blog_posts (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  slug           text        unique not null,
  content        text        not null default '',
  excerpt        text        not null default '',
  featured_image text,
  tags           text[]      not null default '{}',
  seo            jsonb       not null default '{}',
  status         text        not null default 'draft'
                             check (status in ('draft', 'published', 'archived')),
  published_at   timestamptz
);

comment on table public.blog_posts is 'Blog articles with SEO, tags, and draft/published/archived workflow.';

create index idx_blog_posts_slug         on public.blog_posts (slug);
create index idx_blog_posts_status       on public.blog_posts (status);
create index idx_blog_posts_published_at on public.blog_posts (published_at);
create index idx_blog_posts_tags         on public.blog_posts using gin (tags);

-- RLS
alter table public.blog_posts enable row level security;

-- Anyone can read published blog posts
create policy "Anyone can read published blog posts"
  on public.blog_posts for select
  using (status = 'published');

-- Admin full CRUD
create policy "Admin full access to blog_posts"
  on public.blog_posts for all
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
-- Table: content_queue
-- Social-media content scheduling queue. Each row is a post destined for a
-- specific platform, optionally linked back to a source blog post.
-- ---------------------------------------------------------------------------
create table public.content_queue (
  id                 uuid        primary key default gen_random_uuid(),
  platform           text        not null
                                 check (platform in ('linkedin', 'twitter', 'instagram', 'facebook', 'tiktok')),
  content            text        not null,
  media_urls         text[]      not null default '{}',
  status             text        not null default 'draft'
                                 check (status in ('draft', 'approved', 'scheduled', 'published', 'failed')),
  scheduled_for      timestamptz,
  buffer_id          text,
  source_content_id  uuid        references public.blog_posts(id)
);

comment on table public.content_queue is 'Social-media content scheduling queue across platforms.';

create index idx_content_queue_platform          on public.content_queue (platform);
create index idx_content_queue_status            on public.content_queue (status);
create index idx_content_queue_scheduled_for     on public.content_queue (scheduled_for);
create index idx_content_queue_source_content_id on public.content_queue (source_content_id);

-- RLS
alter table public.content_queue enable row level security;

-- Admin only
create policy "Admin full access to content_queue"
  on public.content_queue for all
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

-- Service role for scheduled publishing via cron / edge functions
create policy "Service role full access to content_queue"
  on public.content_queue for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
