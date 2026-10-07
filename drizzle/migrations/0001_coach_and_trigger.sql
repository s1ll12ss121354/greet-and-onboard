drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stats jsonb not null,
  goal text not null,
  advice text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.coach_sessions to authenticated;
grant all on public.coach_sessions to service_role;
alter table public.coach_sessions enable row level security;
create policy "own coach read" on public.coach_sessions for select to authenticated using (user_id = auth.uid());
create policy "own coach insert" on public.coach_sessions for insert to authenticated with check (user_id = auth.uid());