create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  contact text check (contact is null or char_length(trim(contact)) <= 200),
  page_context text not null,
  page_url text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  created_at timestamptz not null default now()
);

create index if not exists app_feedback_created_idx
  on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "Anyone can submit app feedback" on public.app_feedback;
create policy "Anyone can submit app feedback"
  on public.app_feedback
  for insert
  to anon, authenticated
  with check (true);
