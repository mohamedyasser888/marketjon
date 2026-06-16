-- Run if profiles table already exists — adds missing columns without deleting users

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists password text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Migrate old photo_url column name if you used it before
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'photo_url'
  ) then
    update public.profiles set avatar_url = photo_url where avatar_url is null and photo_url is not null;
  end if;
end $$;

alter table public.profiles disable row level security;
grant all on public.profiles to anon, authenticated, service_role;
