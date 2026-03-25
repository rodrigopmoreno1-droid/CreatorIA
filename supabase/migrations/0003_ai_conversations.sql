create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by_user_id uuid references public.users(id) on delete set null,
  title text not null default 'Nova conversa',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_company_idx on public.ai_conversations (company_id);
create index if not exists ai_conversations_last_message_idx on public.ai_conversations (company_id, last_message_at desc);
create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id);
create index if not exists ai_messages_company_idx on public.ai_messages (company_id);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "ai_conversations_policy" on public.ai_conversations
  for all
  using (public.is_company_member(company_id) or public.is_super_admin())
  with check (public.is_company_admin(company_id) or public.is_super_admin());

create policy "ai_messages_policy" on public.ai_messages
  for all
  using (public.is_company_member(company_id) or public.is_super_admin())
  with check (public.is_company_admin(company_id) or public.is_super_admin());

create trigger touch_ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.touch_updated_at();
