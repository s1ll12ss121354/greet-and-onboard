-- ReCorN: restore missing matchmaking tables used by the public RPCs and frontend.

create table if not exists public.match_lobby_members (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_kind text not null default 'player'
    check (member_kind in ('player','spectator')),
  team text
    check (team is null or team in ('alpha','bravo')),
  joined_at timestamptz not null default now(),
  unique (lobby_id, user_id)
);

create index if not exists match_lobby_members_lobby_idx
  on public.match_lobby_members(lobby_id, member_kind);

create index if not exists match_lobby_members_user_idx
  on public.match_lobby_members(user_id);

alter table public.match_lobby_members enable row level security;

drop policy if exists "Members can read lobby members" on public.match_lobby_members;
create policy "Members can read lobby members"
on public.match_lobby_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.match_lobby_members mine
    where mine.lobby_id = match_lobby_members.lobby_id
      and mine.user_id = (select auth.uid())
  )
);

grant select on public.match_lobby_members to authenticated;

notify pgrst, 'reload schema';
