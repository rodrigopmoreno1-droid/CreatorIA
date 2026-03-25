create extension if not exists "pgcrypto";

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.role_id = 'super_admin'
      and m.status = 'active'
  );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role_id in ('super_admin', 'admin')
  );
$$;

create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  plan_slug text not null default 'pro',
  status text not null default 'active',
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  avatar_url text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_id text not null references public.roles(id) on delete restrict,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  instagram_handle text,
  niche text,
  voice text,
  colors jsonb not null default '{}'::jsonb,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  benefits text,
  audience text,
  price numeric(12,2),
  restrictions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  instagram_handle text,
  niche text,
  history text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  hook text,
  source text,
  score numeric(5,2) not null default 0,
  status text not null default 'draft',
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  idea_id uuid references public.content_ideas(id) on delete set null,
  title text not null,
  hook text,
  spoken_text text,
  cta text,
  storyboard jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  scheduled_for timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sequence_id uuid not null references public.story_sequences(id) on delete cascade,
  position integer not null default 0,
  item_type text not null default 'text',
  content jsonb not null default '{}'::jsonb,
  cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  caption text,
  hashtags text[] not null default '{}'::text[],
  location text,
  scheduled_for timestamptz,
  status text not null default 'draft',
  metrics jsonb not null default '{}'::jsonb,
  feed_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_cards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  column_key text not null,
  order_index integer not null default 0,
  assignee_user_id uuid references public.users(id) on delete set null,
  tags text[] not null default '{}'::text[],
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  file_url text,
  storage_path text,
  drive_url text,
  mime_type text,
  size_bytes bigint,
  tags text[] not null default '{}'::text[],
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  metric_key text not null,
  metric_date date not null default current_date,
  value numeric(12,2) not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  handle text,
  niche text,
  website text,
  sentiment text not null default 'neutral',
  notes text,
  monitored boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competitor_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  published_at timestamptz not null default now(),
  post_type text,
  caption text,
  metrics jsonb not null default '{}'::jsonb,
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  competitor_post_id uuid references public.competitor_posts(id) on delete cascade,
  author_name text,
  body text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  body text not null,
  author_name text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  event_type text not null,
  status text not null default 'draft',
  owner_user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  key text not null,
  name text not null,
  enabled boolean not null default false,
  description text,
  scope text not null default 'workspace',
  rollout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_slug text not null,
  status text not null default 'trialing',
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider_invoice_id text,
  number text not null,
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  status text not null default 'open',
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  feature_key text not null,
  quantity integer not null default 0,
  unit text not null default 'count',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memberships_company_idx on public.memberships (company_id);
create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists products_company_idx on public.products (company_id);
create index if not exists content_ideas_company_idx on public.content_ideas (company_id);
create index if not exists scripts_company_idx on public.scripts (company_id);
create index if not exists posts_company_idx on public.posts (company_id);
create index if not exists pipeline_cards_company_idx on public.pipeline_cards (company_id);
create index if not exists assets_company_idx on public.assets (company_id);
create index if not exists metrics_company_idx on public.metrics (company_id);
create index if not exists competitors_company_idx on public.competitors (company_id);
create index if not exists calendar_events_company_idx on public.calendar_events (company_id);
create index if not exists invoices_company_idx on public.invoices (company_id);
create index if not exists usage_logs_company_idx on public.usage_logs (company_id);

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.memberships enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.creators enable row level security;
alter table public.content_ideas enable row level security;
alter table public.scripts enable row level security;
alter table public.story_sequences enable row level security;
alter table public.story_items enable row level security;
alter table public.posts enable row level security;
alter table public.pipeline_cards enable row level security;
alter table public.assets enable row level security;
alter table public.metrics enable row level security;
alter table public.competitors enable row level security;
alter table public.competitor_posts enable row level security;
alter table public.comments enable row level security;
alter table public.notes enable row level security;
alter table public.calendar_events enable row level security;
alter table public.feature_flags enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.usage_logs enable row level security;

create policy "roles_read" on public.roles for select using (auth.uid() is not null);
create policy "companies_read" on public.companies for select using (public.is_company_member(id) or public.is_super_admin());
create policy "companies_admin_write" on public.companies for insert with check (public.is_super_admin());
create policy "companies_update" on public.companies for update using (public.is_company_admin(id) or public.is_super_admin());
create policy "users_self_read" on public.users for select using (id = auth.uid() or public.is_super_admin());
create policy "users_self_write" on public.users for insert with check (id = auth.uid() or public.is_super_admin());
create policy "users_self_update" on public.users for update using (id = auth.uid() or public.is_super_admin());
create policy "memberships_read" on public.memberships for select using (public.is_company_member(company_id) or public.is_super_admin());
create policy "memberships_write" on public.memberships for all using (public.is_company_admin(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "company_tables_read" on public.brands for select using (public.is_company_member(company_id) or public.is_super_admin());
create policy "company_tables_write" on public.brands for all using (public.is_company_admin(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "products_policy" on public.products for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "creators_policy" on public.creators for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "ideas_policy" on public.content_ideas for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "scripts_policy" on public.scripts for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "story_sequences_policy" on public.story_sequences for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "story_items_policy" on public.story_items for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "posts_policy" on public.posts for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "pipeline_policy" on public.pipeline_cards for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "assets_policy" on public.assets for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "metrics_policy" on public.metrics for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "competitors_policy" on public.competitors for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "competitor_posts_policy" on public.competitor_posts for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "comments_policy" on public.comments for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "notes_policy" on public.notes for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "calendar_policy" on public.calendar_events for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "feature_flags_policy" on public.feature_flags for all using ((company_id is null and public.is_super_admin()) or public.is_company_member(company_id) or public.is_super_admin()) with check ((company_id is null and public.is_super_admin()) or public.is_company_admin(company_id) or public.is_super_admin());
create policy "subscriptions_policy" on public.subscriptions for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "invoices_policy" on public.invoices for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());
create policy "usage_policy" on public.usage_logs for all using (public.is_company_member(company_id) or public.is_super_admin()) with check (public.is_company_admin(company_id) or public.is_super_admin());

create trigger touch_companies_updated_at before update on public.companies for each row execute function public.touch_updated_at();
create trigger touch_users_updated_at before update on public.users for each row execute function public.touch_updated_at();
create trigger touch_memberships_updated_at before update on public.memberships for each row execute function public.touch_updated_at();
create trigger touch_brands_updated_at before update on public.brands for each row execute function public.touch_updated_at();
create trigger touch_products_updated_at before update on public.products for each row execute function public.touch_updated_at();
create trigger touch_creators_updated_at before update on public.creators for each row execute function public.touch_updated_at();
create trigger touch_content_ideas_updated_at before update on public.content_ideas for each row execute function public.touch_updated_at();
create trigger touch_scripts_updated_at before update on public.scripts for each row execute function public.touch_updated_at();
create trigger touch_story_sequences_updated_at before update on public.story_sequences for each row execute function public.touch_updated_at();
create trigger touch_story_items_updated_at before update on public.story_items for each row execute function public.touch_updated_at();
create trigger touch_posts_updated_at before update on public.posts for each row execute function public.touch_updated_at();
create trigger touch_pipeline_cards_updated_at before update on public.pipeline_cards for each row execute function public.touch_updated_at();
create trigger touch_assets_updated_at before update on public.assets for each row execute function public.touch_updated_at();
create trigger touch_metrics_updated_at before update on public.metrics for each row execute function public.touch_updated_at();
create trigger touch_competitors_updated_at before update on public.competitors for each row execute function public.touch_updated_at();
create trigger touch_competitor_posts_updated_at before update on public.competitor_posts for each row execute function public.touch_updated_at();
create trigger touch_comments_updated_at before update on public.comments for each row execute function public.touch_updated_at();
create trigger touch_notes_updated_at before update on public.notes for each row execute function public.touch_updated_at();
create trigger touch_calendar_events_updated_at before update on public.calendar_events for each row execute function public.touch_updated_at();
create trigger touch_feature_flags_updated_at before update on public.feature_flags for each row execute function public.touch_updated_at();
create trigger touch_subscriptions_updated_at before update on public.subscriptions for each row execute function public.touch_updated_at();
create trigger touch_invoices_updated_at before update on public.invoices for each row execute function public.touch_updated_at();
