alter table public.ai_conversations
  add column if not exists deleted_at timestamptz;

alter table public.ai_conversations
  add column if not exists deleted_by_user_id uuid references public.users(id) on delete set null;

create index if not exists ai_conversations_company_active_idx
  on public.ai_conversations (company_id, last_message_at desc)
  where deleted_at is null;

create index if not exists ai_conversations_company_trash_idx
  on public.ai_conversations (company_id, deleted_at desc)
  where deleted_at is not null;
