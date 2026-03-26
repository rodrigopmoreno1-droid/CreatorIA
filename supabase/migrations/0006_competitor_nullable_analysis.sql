alter table public.competitors
  alter column analysis drop default,
  alter column analysis drop not null,
  alter column source_snapshot drop default,
  alter column source_snapshot drop not null;

update public.competitors
set analysis = null
where analysis = '{}'::jsonb;

update public.competitors
set source_snapshot = null
where source_snapshot = '{}'::jsonb;
