-- =============================================================================
-- Migration 00002: Products & Courses
-- =============================================================================
-- Products (tied to Stripe), purchases, and a simple course structure
-- (modules -> lessons -> lesson_progress).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: products
-- Represents a purchasable item (digital product, course, subscription).
-- Synced with Stripe via stripe_product_id / stripe_price_id.
-- ---------------------------------------------------------------------------
create table public.products (
  id                    uuid        primary key default gen_random_uuid(),
  name                  text        not null,
  description           text        not null default '',
  stripe_product_id     text,
  stripe_price_id       text,
  price_amount          int         not null default 0,
  currency              text        not null default 'usd',
  price_type            text        not null default 'one_time'
                                    check (price_type in ('one_time', 'subscription')),
  subscription_interval text        check (subscription_interval in ('month', 'year') or subscription_interval is null),
  features              jsonb       not null default '[]',
  is_active             boolean     not null default true,
  sort_order            int         not null default 0,
  created_at            timestamptz not null default now()
);

comment on table public.products is 'Purchasable products / subscriptions, synced with Stripe.';

create index idx_products_is_active         on public.products (is_active);
create index idx_products_stripe_product_id on public.products (stripe_product_id);
create index idx_products_sort_order        on public.products (sort_order);

-- RLS
alter table public.products enable row level security;

-- Anyone can read active products (public catalog)
create policy "Anyone can read active products"
  on public.products for select
  using (is_active = true);

-- Admin full CRUD
create policy "Admin full access to products"
  on public.products for all
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
-- Table: purchases
-- Records of completed purchases linking a user to a product.
-- Populated primarily by Stripe webhook handlers (service role).
-- ---------------------------------------------------------------------------
create table public.purchases (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  product_id        uuid        not null references public.products(id),
  stripe_payment_id text,
  amount            int         not null default 0,
  currency          text        not null default 'usd',
  status            text        not null default 'active'
                                check (status in ('active', 'refunded', 'cancelled', 'expired')),
  purchased_at      timestamptz not null default now(),
  expires_at        timestamptz
);

comment on table public.purchases is 'Purchase records linking users to products. Created by Stripe webhooks.';

create index idx_purchases_user_id    on public.purchases (user_id);
create index idx_purchases_product_id on public.purchases (product_id);
create index idx_purchases_status     on public.purchases (status);

-- RLS
alter table public.purchases enable row level security;

-- Users can read their own purchases
create policy "Users can read own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- Admin can read all purchases
create policy "Admin can read all purchases"
  on public.purchases for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role can insert (Stripe webhooks)
create policy "Service role can insert purchases"
  on public.purchases for insert
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Service role can update (refunds, cancellations)
create policy "Service role can update purchases"
  on public.purchases for update
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: modules
-- Course modules (sections / chapters). Optionally tied to a product; when
-- product_id is null the module is available to all customers.
-- ---------------------------------------------------------------------------
create table public.modules (
  id           uuid    primary key default gen_random_uuid(),
  product_id   uuid    references public.products(id),
  title        text    not null,
  description  text    not null default '',
  sort_order   int     not null default 0,
  is_published boolean not null default false
);

comment on table public.modules is 'Course modules / sections. Null product_id = accessible to all customers.';

create index idx_modules_product_id   on public.modules (product_id);
create index idx_modules_is_published on public.modules (is_published);
create index idx_modules_sort_order   on public.modules (sort_order);

-- RLS
alter table public.modules enable row level security;

-- Anyone can read published modules (portal checks purchase access in app layer)
create policy "Anyone can read published modules"
  on public.modules for select
  using (is_published = true);

-- Admin full CRUD
create policy "Admin full access to modules"
  on public.modules for all
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
-- Table: lessons
-- Individual lessons within a module. Can include markdown content, a video
-- URL, and downloadable file references.
-- ---------------------------------------------------------------------------
create table public.lessons (
  id           uuid    primary key default gen_random_uuid(),
  module_id    uuid    not null references public.modules(id) on delete cascade,
  title        text    not null,
  content      text    not null default '',
  video_url    text,
  downloads    jsonb   not null default '[]',
  sort_order   int     not null default 0,
  is_published boolean not null default false
);

comment on table public.lessons is 'Individual lessons inside a module (content, video, downloads).';

create index idx_lessons_module_id    on public.lessons (module_id);
create index idx_lessons_is_published on public.lessons (is_published);
create index idx_lessons_sort_order   on public.lessons (sort_order);

-- RLS
alter table public.lessons enable row level security;

-- Anyone can read published lessons
create policy "Anyone can read published lessons"
  on public.lessons for select
  using (is_published = true);

-- Admin full CRUD
create policy "Admin full access to lessons"
  on public.lessons for all
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
-- Table: lesson_progress
-- Tracks per-user completion of individual lessons.
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  lesson_id    uuid        not null references public.lessons(id) on delete cascade,
  completed    boolean     not null default false,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

comment on table public.lesson_progress is 'Per-user lesson completion tracking.';

create index idx_lesson_progress_user_id   on public.lesson_progress (user_id);
create index idx_lesson_progress_lesson_id on public.lesson_progress (lesson_id);

-- RLS
alter table public.lesson_progress enable row level security;

-- Users can read their own progress
create policy "Users can read own lesson progress"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

-- Users can insert their own progress
create policy "Users can insert own lesson progress"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

-- Users can update their own progress
create policy "Users can update own lesson progress"
  on public.lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin can read all progress
create policy "Admin can read all lesson progress"
  on public.lesson_progress for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
