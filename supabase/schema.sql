create table if not exists public.cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cloud_snapshots enable row level security;

drop policy if exists "Users can read their own cheshbon snapshot" on public.cloud_snapshots;
create policy "Users can read their own cheshbon snapshot"
on public.cloud_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own cheshbon snapshot" on public.cloud_snapshots;
create policy "Users can insert their own cheshbon snapshot"
on public.cloud_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own cheshbon snapshot" on public.cloud_snapshots;
create policy "Users can update their own cheshbon snapshot"
on public.cloud_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_cloud_snapshot_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_cloud_snapshot_updated_at on public.cloud_snapshots;
create trigger touch_cloud_snapshot_updated_at
before update on public.cloud_snapshots
for each row
execute function public.touch_cloud_snapshot_updated_at();
