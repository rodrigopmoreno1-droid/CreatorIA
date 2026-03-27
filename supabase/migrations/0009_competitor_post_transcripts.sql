alter table public.competitor_posts
  add column if not exists transcript_text text,
  add column if not exists transcript_status text not null default 'missing',
  add column if not exists transcript_source text not null default 'none',
  add column if not exists transcript_confidence numeric(4,2),
  add column if not exists transcript_error text,
  add column if not exists screen_text_lead text;

update public.competitor_posts
set
  transcript_text = nullif(transcript_text, ''),
  transcript_error = nullif(transcript_error, ''),
  screen_text_lead = nullif(screen_text_lead, '')
where true;

alter table public.competitor_posts
  alter column transcript_status set default 'missing',
  alter column transcript_source set default 'none';

drop trigger if exists touch_competitor_posts_updated_at on public.competitor_posts;
create trigger touch_competitor_posts_updated_at
before update on public.competitor_posts
for each row execute function public.touch_updated_at();
