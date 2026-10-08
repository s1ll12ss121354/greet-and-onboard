-- ReCorN: restore the full Supabase matchmaking base schema.

create extension if not exists pgcrypto;

create table if not exists public.match_lobbies (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'searching'
    check (status in (
      'waiting','searching','full','host_needed','ready',
      'ready_check','in_game','cancelled'
    )),
  target_players integer not null default 10 check (target_players between 1 and 10),
  max_players integer not null default 10 check (max_players between 1 and 10),
  search_started_at timestamptz not null default now(),
  host_user_id uuid references auth.users(id) on delete set null,
  host_needed_notified_at timestamptz,
  selected_map text,
  ready_check_started_at timestamptz,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists match_lobbies_status_started_idx
  on public.match_lobbies(status, search_started_at);

create index if not exists match_lobbies_creator_idx
  on public.match_lobbies(creator_id);

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

create table if not exists public.match_lobby_map_votes (
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  map_name text not null check (map_name in ('Mirage','Dust II','Nuke')),
  created_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

create index if not exists match_lobby_map_votes_lobby_idx
  on public.match_lobby_map_votes(lobby_id);

create table if not exists public.host_notifications (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  status text not null default 'unread'
    check (status in ('unread','read','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists host_notifications_user_status_idx
  on public.host_notifications(host_user_id, status, created_at desc);

alter table public.match_lobbies enable row level security;
alter table public.match_lobby_members enable row level security;
alter table public.match_lobby_map_votes enable row level security;
alter table public.host_notifications enable row level security;

drop policy if exists "Authenticated users can read active lobbies" on public.match_lobbies;
create policy "Authenticated users can read active lobbies"
on public.match_lobbies
for select
to authenticated
using (
  status <> 'cancelled'
  and (
    creator_id = (select auth.uid())
    or exists (
      select 1
      from public.match_lobby_members m
      where m.lobby_id = match_lobbies.id
        and m.user_id = (select auth.uid())
    )
  )
);

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

drop policy if exists "Lobby members can read map votes" on public.match_lobby_map_votes;
create policy "Lobby members can read map votes"
on public.match_lobby_map_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.match_lobby_members m
    where m.lobby_id = match_lobby_map_votes.lobby_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read own host notifications" on public.host_notifications;
create policy "Users can read own host notifications"
on public.host_notifications
for select
to authenticated
using (host_user_id = (select auth.uid()));

grant select on public.match_lobbies to authenticated;
grant select on public.match_lobby_members to authenticated;
grant select on public.match_lobby_map_votes to authenticated;
grant select on public.host_notifications to authenticated;

notify pgrst, 'reload schema';
