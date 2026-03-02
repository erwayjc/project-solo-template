-- =============================================================================
-- Migration 00008: Extras — announcements, media
-- =============================================================================
-- Announcements power the portal dashboard banner system (info, updates, alerts).
-- Media provides a centralised asset library for images, downloads, and files
-- used across blog posts, lessons, branding, and lead magnets.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: announcements
-- ---------------------------------------------------------------------------
create table public.announcements (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  content      text        not null default '',
  type         text        not null default 'info'
                           check (type in ('info', 'update', 'alert')),
  is_published boolean     not null default false,
  published_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

comment on table  public.announcements is 'Portal announcements shown on the customer dashboard.';
comment on column public.announcements.type is 'Display style: info (blue), update (green), alert (red/yellow).';
comment on column public.announcements.expires_at is 'Announcement is hidden after this timestamp. NULL = never expires.';

-- RLS
alter table public.announcements enable row level security;

-- Anyone can read published, non-expired announcements
create policy "Anyone can read published announcements"
  on public.announcements for select
  using (
    is_published = true
    and (expires_at is null or expires_at > now())
  );

-- Admin can read all announcements (including unpublished / expired)
create policy "Admin can read all announcements"
  on public.announcements for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can create announcements
create policy "Admin can create announcements"
  on public.announcements for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can update announcements
create policy "Admin can update announcements"
  on public.announcements for update
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

-- Admin can delete announcements
create policy "Admin can delete announcements"
  on public.announcements for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role full access
create policy "Service role full access on announcements"
  on public.announcements for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: media
-- ---------------------------------------------------------------------------
create table public.media (
  id          uuid        primary key default gen_random_uuid(),
  filename    text        not null,
  url         text        not null,
  mime_type   text,
  size_bytes  int,
  alt_text    text        not null default '',
  context     text        not null default 'general',
  uploaded_by uuid        references public.profiles(id),
  created_at  timestamptz not null default now()
);

comment on table  public.media is 'Centralised media/asset library for all uploaded files.';
comment on column public.media.context is 'Usage context: blog, lesson, branding, lead_magnet, or general.';
comment on column public.media.uploaded_by is 'Profile that uploaded the file. NULL for system-seeded assets.';

-- Indexes
create index idx_media_context     on public.media (context);
create index idx_media_uploaded_by on public.media (uploaded_by);

-- RLS
alter table public.media enable row level security;

-- Admin can read all media
create policy "Admin can read media"
  on public.media for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can upload media
create policy "Admin can create media"
  on public.media for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can update media metadata
create policy "Admin can update media"
  on public.media for update
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

-- Admin can delete media
create policy "Admin can delete media"
  on public.media for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role full access
create policy "Service role full access on media"
  on public.media for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
