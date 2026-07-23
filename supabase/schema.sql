create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.mountains (
  id text primary key,
  name text not null,
  province text not null,
  city text not null,
  latitude double precision not null,
  longitude double precision not null,
  elevation_meters integer not null,
  address text not null,
  short_description text not null,
  selection_reason text not null,
  detail_status text not null default 'basic',
  created_at timestamptz not null default now()
);

create table if not exists public.completed_mountains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mountain_id text not null,
  completed_at timestamptz not null default now(),
  climbed_on date not null default current_date,
  photo_url text,
  constraint completed_mountains_user_mountain_key unique (user_id, mountain_id)
);

create index if not exists completed_mountains_user_mountain_idx
  on public.completed_mountains (user_id, mountain_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.mountains enable row level security;
alter table public.completed_mountains enable row level security;

create policy "Public can read mountains"
  on public.mountains
  for select
  to anon, authenticated
  using (true);

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their completed mountains"
  on public.completed_mountains
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their completed mountains"
  on public.completed_mountains
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their completed mountains"
  on public.completed_mountains
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their completed mountains"
  on public.completed_mountains
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
