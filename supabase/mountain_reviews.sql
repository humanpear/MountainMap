create table if not exists public.mountain_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mountain_id text not null,
  route_name text not null,
  route_start_point text,
  route_end_point text,
  author_name text not null default '등산객',
  difficulty text not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  duration_label text not null,
  body text not null check (char_length(trim(body)) between 1 and 100),
  image_urls text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mountain_reviews
  add column if not exists route_start_point text,
  add column if not exists route_end_point text;

create index if not exists mountain_reviews_mountain_created_idx
  on public.mountain_reviews (mountain_id, created_at desc);

create index if not exists mountain_reviews_mountain_route_created_idx
  on public.mountain_reviews (mountain_id, route_name, created_at desc);

create index if not exists mountain_reviews_user_created_idx
  on public.mountain_reviews (user_id, created_at desc);

create or replace function public.set_mountain_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_mountain_reviews_updated_at on public.mountain_reviews;
create trigger set_mountain_reviews_updated_at
  before update on public.mountain_reviews
  for each row
  execute function public.set_mountain_reviews_updated_at();

alter table public.mountain_reviews enable row level security;

drop policy if exists "Public can read mountain reviews" on public.mountain_reviews;
create policy "Public can read mountain reviews"
  on public.mountain_reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can insert their own mountain reviews" on public.mountain_reviews;
create policy "Users can insert their own mountain reviews"
  on public.mountain_reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own mountain reviews" on public.mountain_reviews;
create policy "Users can update their own mountain reviews"
  on public.mountain_reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own mountain reviews" on public.mountain_reviews;
create policy "Users can delete their own mountain reviews"
  on public.mountain_reviews
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mountain-review-images',
  'mountain-review-images',
  true,
  3145728,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read mountain review images" on storage.objects;
create policy "Public can read mountain review images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'mountain-review-images');

drop policy if exists "Users can upload their own mountain review images" on storage.objects;
create policy "Users can upload their own mountain review images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'mountain-review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own mountain review images" on storage.objects;
create policy "Users can update their own mountain review images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'mountain-review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'mountain-review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own mountain review images" on storage.objects;
create policy "Users can delete their own mountain review images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'mountain-review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
