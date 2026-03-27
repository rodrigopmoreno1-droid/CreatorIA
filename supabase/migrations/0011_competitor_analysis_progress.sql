alter table public.competitors
  add column if not exists analysis_progress jsonb;

