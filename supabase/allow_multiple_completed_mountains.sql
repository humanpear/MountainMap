-- Deprecated: the current product treats completion as a binary state per mountain.
-- Use enforce_unique_completed_mountains.sql for the current schema.
-- This historical migration was used when completed_mountains was created with
-- primary key (user_id, mountain_id). This changes completion records from
-- "one row per mountain" to "one row per climb", which allows multiple medals.

create extension if not exists pgcrypto;

alter table public.completed_mountains
  add column if not exists id uuid default gen_random_uuid();

update public.completed_mountains
set id = gen_random_uuid()
where id is null;

alter table public.completed_mountains
  alter column id set default gen_random_uuid();

alter table public.completed_mountains
  alter column id set not null;

alter table public.completed_mountains
  drop constraint if exists completed_mountains_pkey;

alter table public.completed_mountains
  add constraint completed_mountains_pkey primary key (id);

create index if not exists completed_mountains_user_mountain_idx
  on public.completed_mountains (user_id, mountain_id, completed_at desc);
