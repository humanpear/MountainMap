-- Add user-entered climb dates and one completion photo per completed mountain.
begin;

alter table public.completed_mountains
  add column if not exists climbed_on date;

alter table public.completed_mountains
  add column if not exists photo_url text;

update public.completed_mountains
set climbed_on = completed_at::date
where climbed_on is null;

alter table public.completed_mountains
  alter column climbed_on set default current_date,
  alter column climbed_on set not null;

commit;

drop policy if exists "Users can update their completed mountains" on public.completed_mountains;
create policy "Users can update their completed mountains"
  on public.completed_mountains
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mountain-completion-images',
  'mountain-completion-images',
  true,
  5242880,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read mountain completion images" on storage.objects;
create policy "Public can read mountain completion images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'mountain-completion-images');

drop policy if exists "Users can upload their own mountain completion images" on storage.objects;
create policy "Users can upload their own mountain completion images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mountain-completion-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own mountain completion images" on storage.objects;
create policy "Users can delete their own mountain completion images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'mountain-completion-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
