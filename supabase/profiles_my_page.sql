alter table public.profiles
  add column if not exists display_name_normalized text,
  add column if not exists avatar_kind text not null default 'default-1',
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set display_name_normalized = lower(regexp_replace(trim(display_name), '\s+', ' ', 'g'))
where display_name is not null
  and trim(display_name) <> ''
  and display_name_normalized is null;

drop index if exists public.profiles_display_name_normalized_key;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.display_name_normalized = nullif(lower(regexp_replace(trim(coalesce(new.display_name, '')), '\s+', ' ', 'g')), '');
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before insert or update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace view public.public_profiles as
select
  id,
  display_name,
  avatar_url,
  avatar_kind,
  updated_at
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  3145728,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read profile images" on storage.objects;
create policy "Public can read profile images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'profile-images');

drop policy if exists "Users can upload their own profile images" on storage.objects;
create policy "Users can upload their own profile images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own profile images" on storage.objects;
create policy "Users can update their own profile images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own profile images" on storage.objects;
create policy "Users can delete their own profile images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
