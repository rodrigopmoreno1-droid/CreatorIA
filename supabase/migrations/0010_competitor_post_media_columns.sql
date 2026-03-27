alter table public.competitor_posts
  add column if not exists downloaded_video_url text,
  add column if not exists video_url text,
  add column if not exists media_type text,
  add column if not exists carousel_items jsonb;
