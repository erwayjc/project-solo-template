-- =============================================================================
-- Migration 00020: Custom Pages — HTML/CSS/JS page builder for Dev Agent
-- =============================================================================
-- Extends the pages table with columns to support custom HTML pages alongside
-- the existing JSON section-based pages. Uses a render_mode discriminator.
-- =============================================================================

-- Add render_mode discriminator (existing pages default to 'sections')
alter table public.pages
  add column render_mode text not null default 'sections'
    check (render_mode in ('sections', 'custom'));

-- Full sanitized HTML/CSS/JS document body for custom pages
alter table public.pages
  add column html_content text;

-- One-level undo: previous version of html_content
alter table public.pages
  add column html_content_previous text;

-- Timestamp of last sanitization pass
alter table public.pages
  add column sanitized_at timestamptz;

-- Lightweight page view counter
alter table public.pages
  add column view_count integer not null default 0;

-- ---------------------------------------------------------------------------
-- Atomic view count increment function (avoids TOCTOU race condition)
-- ---------------------------------------------------------------------------
create or replace function public.increment_page_view_count(page_id uuid)
returns void
language sql
security definer
as $$
  update public.pages
  set view_count = view_count + 1
  where id = page_id;
$$;

-- ---------------------------------------------------------------------------
-- Add custom page tools to the Dev Agent's allowed tools list.
-- Uses array_cat to append without overwriting existing tools.
-- Conditional: only runs if the dev-agent row exists (may not in fresh deploys).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.agents where slug = 'dev-agent') then
    update public.agents
    set tools = array_cat(tools, ARRAY[
      'create_custom_page',
      'update_custom_page',
      'get_custom_page',
      'list_custom_pages',
      'get_page_stats'
    ])
    where slug = 'dev-agent'
      and not tools @> ARRAY['create_custom_page'];
  end if;
end $$;
