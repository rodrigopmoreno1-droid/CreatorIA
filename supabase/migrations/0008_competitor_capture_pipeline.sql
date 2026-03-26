create table if not exists public.competitor_captures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  source text not null default 'automatic',
  status text not null default 'success',
  bio text not null default '',
  captions jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '[]'::jsonb,
  post_types jsonb not null default '[]'::jsonb,
  hooks_detected jsonb not null default '[]'::jsonb,
  ctas_detected jsonb not null default '[]'::jsonb,
  transcript_text jsonb not null default '[]'::jsonb,
  capture_notes jsonb not null default '[]'::jsonb,
  posts_captured integer not null default 0,
  reels_captured integer not null default 0,
  feed_captured integer not null default 0,
  raw_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists competitor_captures_company_idx
  on public.competitor_captures (company_id, created_at desc);

create index if not exists competitor_captures_competitor_idx
  on public.competitor_captures (competitor_id, created_at desc);

alter table public.competitor_captures enable row level security;

drop policy if exists "competitor_captures_policy" on public.competitor_captures;
create policy "competitor_captures_policy"
  on public.competitor_captures
  for all
  using (public.is_company_member(company_id) or public.is_super_admin())
  with check (public.is_company_admin(company_id) or public.is_super_admin());

drop trigger if exists touch_competitor_captures_updated_at on public.competitor_captures;
create trigger touch_competitor_captures_updated_at
before update on public.competitor_captures
for each row execute function public.touch_updated_at();

create table if not exists public.competitor_patterns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  capture_id uuid references public.competitor_captures(id) on delete set null,
  data_quality text not null default 'unknown',
  tone text not null default '',
  most_common_cta text not null default '',
  most_common_hook_type text not null default '',
  most_common_format text not null default '',
  narrative_structure text not null default '',
  content_pillars jsonb not null default '[]'::jsonb,
  recurring_themes jsonb not null default '[]'::jsonb,
  top_words jsonb not null default '[]'::jsonb,
  format_mix jsonb not null default '[]'::jsonb,
  hook_patterns jsonb not null default '[]'::jsonb,
  cta_patterns jsonb not null default '[]'::jsonb,
  pattern_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, competitor_id)
);

create index if not exists competitor_patterns_company_idx
  on public.competitor_patterns (company_id, updated_at desc);

create index if not exists competitor_patterns_competitor_idx
  on public.competitor_patterns (competitor_id);

alter table public.competitor_patterns enable row level security;

drop policy if exists "competitor_patterns_policy" on public.competitor_patterns;
create policy "competitor_patterns_policy"
  on public.competitor_patterns
  for all
  using (public.is_company_member(company_id) or public.is_super_admin())
  with check (public.is_company_admin(company_id) or public.is_super_admin());

drop trigger if exists touch_competitor_patterns_updated_at on public.competitor_patterns;
create trigger touch_competitor_patterns_updated_at
before update on public.competitor_patterns
for each row execute function public.touch_updated_at();
