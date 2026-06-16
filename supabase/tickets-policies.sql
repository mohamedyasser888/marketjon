-- Run in Supabase SQL Editor

-- Realtime (also enable in Dashboard → Database → Replication → tickets ON)
alter publication supabase_realtime add table public.tickets;

alter table public.tickets enable row level security;

drop policy if exists "Users can view their own tickets" on public.tickets;
create policy "Users can view their own tickets"
  on public.tickets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own tickets" on public.tickets;
create policy "Users can update their own tickets"
  on public.tickets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can create tickets" on public.tickets;
create policy "Users can create tickets"
  on public.tickets for insert
  with check (auth.uid() = user_id);

grant select, insert, update on public.tickets to authenticated;
