create table if not exists public.content_planner_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by_user_id uuid references public.users(id) on delete set null,
  mode text not null default 'create',
  status text not null default 'queued',
  range_start date not null,
  range_end date not null,
  reason text,
  config jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  progress_total integer not null default 0,
  progress_completed integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_planner_batches_company_idx
  on public.content_planner_batches (company_id, created_at desc);

create index if not exists content_planner_batches_status_idx
  on public.content_planner_batches (company_id, status);

alter table public.content_planner_batches enable row level security;

drop policy if exists "content_planner_batches_policy" on public.content_planner_batches;
create policy "content_planner_batches_policy"
  on public.content_planner_batches
  for all
  using (public.is_company_member(company_id) or public.is_super_admin())
  with check (public.is_company_admin(company_id) or public.is_super_admin());

drop trigger if exists touch_content_planner_batches_updated_at on public.content_planner_batches;
create trigger touch_content_planner_batches_updated_at
before update on public.content_planner_batches
for each row execute function public.touch_updated_at();
