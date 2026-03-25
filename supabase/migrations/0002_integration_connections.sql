create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  status text not null default 'connected',
  page_id text,
  page_name text,
  instagram_account_id text,
  instagram_username text,
  access_token_encrypted text not null,
  token_type text,
  scopes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists integration_connections_company_idx on public.integration_connections (company_id);
create index if not exists integration_connections_provider_idx on public.integration_connections (provider);

alter table public.integration_connections enable row level security;

drop policy if exists "integration_connections_read" on public.integration_connections;
drop policy if exists "integration_connections_write" on public.integration_connections;

create policy "integration_connections_read"
on public.integration_connections
for select
using (public.is_company_member(company_id) or public.is_super_admin());

create policy "integration_connections_write"
on public.integration_connections
for all
using (public.is_company_admin(company_id) or public.is_super_admin())
with check (public.is_company_admin(company_id) or public.is_super_admin());

drop trigger if exists touch_integration_connections_updated_at on public.integration_connections;

create trigger touch_integration_connections_updated_at
before update on public.integration_connections
for each row execute function public.touch_updated_at();
