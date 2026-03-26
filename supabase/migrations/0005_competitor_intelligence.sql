alter table public.competitors
  add column if not exists profile_type text not null default 'competitor',
  add column if not exists logo_url text,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists analysis_status text not null default 'idle',
  add column if not exists analysis_error text,
  add column if not exists analysis jsonb not null default '{}'::jsonb,
  add column if not exists source_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists last_analyzed_at timestamptz;

alter table public.competitor_posts
  add column if not exists source_url text,
  add column if not exists thumbnail_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.content_references (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete set null,
  title text not null,
  content text not null,
  hook_type text,
  cta_type text,
  format text,
  image_url text,
  notes text,
  liked boolean not null default true,
  category text not null default '',
  source text not null default 'manual',
  source_insight_id text not null default '',
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_references_company_idx on public.content_references (company_id);
create index if not exists content_references_competitor_idx on public.content_references (competitor_id);
create index if not exists content_references_liked_idx on public.content_references (company_id, liked);
create unique index if not exists content_references_insight_unique_idx
  on public.content_references (company_id, source_insight_id)
  where source_insight_id <> '';

alter table public.content_references enable row level security;

drop policy if exists "content_references_policy" on public.content_references;
create policy "content_references_policy"
  on public.content_references
  for all
  using (public.is_company_member(company_id) or public.is_super_admin())
  with check (public.is_company_admin(company_id) or public.is_super_admin());

drop trigger if exists touch_content_references_updated_at on public.content_references;
create trigger touch_content_references_updated_at
before update on public.content_references
for each row execute function public.touch_updated_at();
