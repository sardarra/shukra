-- Track daily AI prompt usage per user
create table if not exists public.ai_usage (
  user_id  uuid    not null references auth.users(id) on delete cascade,
  utc_date date    not null,
  count    integer not null default 0,
  primary key (user_id, utc_date)
);

-- Only the owning user may read/write their own row
alter table public.ai_usage enable row level security;

create policy "Users can read own usage"
  on public.ai_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.ai_usage for update
  using (auth.uid() = user_id);
