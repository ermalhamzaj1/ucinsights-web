-- UCInsights — Supabase schema
-- Run this once in your project: Supabase dashboard -> SQL Editor -> paste -> Run.
-- It creates one row per user holding their profile, tracker and meds, locked
-- down with Row-Level Security so a user can only ever read/write their own row.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  profile    jsonb       not null default '{}'::jsonb,   -- uc-profile-v1
  tracker    jsonb       not null default '{}'::jsonb,   -- uc-tracker-v1 (entries keyed by date)
  meds       jsonb       not null default '[]'::jsonb,   -- uc-meds-v1
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- A user can only touch the row whose user_id matches their auth uid.
drop policy if exists "own row select" on public.user_state;
create policy "own row select" on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.user_state;
create policy "own row insert" on public.user_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.user_state;
create policy "own row update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row delete" on public.user_state;
create policy "own row delete" on public.user_state
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh on every write (used for last-write-wins sync).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_state_touch on public.user_state;
create trigger user_state_touch
  before update on public.user_state
  for each row execute function public.touch_updated_at();
