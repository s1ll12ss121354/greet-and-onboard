-- ReCorN: repair missing schema dependencies discovered by recorn_diagnostics.
-- Safe/idempotent. This migration does not delete user data.
--
-- It repairs the exact missing pieces reported by the diagnostic:
--   profiles.last_seen_at
--   profiles.ban_until / ban_reason
--   public.security_rate_limits
--   public.match_results
--   public.match_result_players
--
-- The main security migration 20261009010000_top_security_hardening.sql
-- was also patched to consume these dependencies safely.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists ban_until timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_ban_until_idx
  on public.profiles(ban_until);

create table if not exists public.security_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (user_id, action)
);

alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public, anon, authenticated;

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  screenshot_path text,
  created_at timestamptz not null default now(),
  unique (lobby_id)
);

create table if not exists public.match_result_players (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.match_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kills integer not null check (kills >= 0 and kills <= 999),
  deaths integer not null check (deaths >= 0 and deaths <= 999),
  won boolean not null default false,
  kd numeric(10,3) not null,
  elo_delta integer not null,
  unique (result_id, user_id)
);

alter table public.match_results enable row level security;
alter table public.match_result_players enable row level security;

revoke all on public.match_results from public, anon, authenticated;
revoke all on public.match_result_players from public, anon, authenticated;

grant select on public.match_results to authenticated;
grant select on public.match_result_players to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Missing RPCs from earlier matchmaking migrations.
-- Recreate the current 10-player flow here as a final repair layer.
-- ---------------------------------------------------------------------------

create or replace function public.mm_create_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  lobby_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_active_ban(uid) then
    raise exception 'PLAYER_BANNED';
  end if;

  select lm.lobby_id
    into lobby_id
  from public.match_lobby_members lm
  join public.match_lobbies l on l.id = lm.lobby_id
  where lm.user_id = uid
    and lm.member_kind = 'player'
    and l.status in ('waiting','searching','full','host_needed','ready')
  order by lm.joined_at desc
  limit 1;

  if lobby_id is not null then
    return lobby_id;
  end if;

  insert into public.match_lobbies (
    creator_id,
    status,
    target_players,
    max_players,
    search_started_at,
    last_activity_at
  )
  values (
    uid,
    'waiting',
    10,
    10,
    now(),
    now()
  )
  returning id into lobby_id;

  insert into public.match_lobby_members (
    lobby_id,
    user_id,
    member_kind
  )
  values (
    lobby_id,
    uid,
    'player'
  );

  return lobby_id;
end;
$$;

create or replace function public.mm_leave_lobby(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  remaining_players integer;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  delete from public.match_lobby_members
  where lobby_id = p_lobby_id
    and user_id = uid;

  select count(*)
    into remaining_players
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  update public.match_lobbies
  set
    status = case
      when remaining_players = 0 then 'cancelled'
      when remaining_players < 10 then 'searching'
      when host_user_id is null then 'host_needed'
      else 'ready'
    end,
    host_user_id = case
      when host_user_id = uid then null
      else host_user_id
    end,
    last_activity_at = now()
  where id = p_lobby_id;

  return true;
end;
$$;

create or replace function public.mm_assign_teams(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  row_member record;
  alpha_elo integer := 0;
  bravo_elo integer := 0;
  alpha_count integer := 0;
  bravo_count integer := 0;
  player_total integer;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.match_lobby_members
    where lobby_id = p_lobby_id
      and user_id = uid
      and member_kind = 'player'
  ) then
    raise exception 'PLAYER_ONLY';
  end if;

  perform 1
  from public.match_lobbies
  where id = p_lobby_id
  for update;

  if not found then
    raise exception 'LOBBY_NOT_FOUND';
  end if;

  select count(*)
    into player_total
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  if player_total < 10 then
    raise exception 'NEED_10_PLAYERS';
  end if;

  update public.match_lobby_members
  set team = null
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  for row_member in
    select
      m.id,
      m.user_id,
      coalesce(p.elo, 1000) as elo
    from public.match_lobby_members m
    join public.profiles p
      on p.id = m.user_id
    where m.lobby_id = p_lobby_id
      and m.member_kind = 'player'
    order by coalesce(p.elo, 1000) desc, m.joined_at, m.id
  loop
    if alpha_count < 5
       and (bravo_count >= 5 or alpha_elo <= bravo_elo) then

      update public.match_lobby_members
      set team = 'alpha'
      where id = row_member.id;

      alpha_elo := alpha_elo + row_member.elo;
      alpha_count := alpha_count + 1;
    else
      update public.match_lobby_members
      set team = 'bravo'
      where id = row_member.id;

      bravo_elo := bravo_elo + row_member.elo;
      bravo_count := bravo_count + 1;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.mm_join_lobby(
  p_lobby_id uuid,
  p_spectator boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  lobby_status text;
  host_id uuid;
  selected_map text;
  total_count integer;
  player_count integer;
  is_staff boolean;
  is_admin boolean;
  result_kind text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_active_ban(uid) then
    raise exception 'PLAYER_BANNED';
  end if;

  select l.status, l.host_user_id, l.selected_map
    into lobby_status, host_id, selected_map
  from public.match_lobbies l
  where l.id = p_lobby_id
    and l.status <> 'cancelled'
  for update;

  if lobby_status is null then
    raise exception 'LOBBY_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.match_lobby_members
    where lobby_id = p_lobby_id
      and user_id = uid
  ) then
    return jsonb_build_object(
      'ok', true,
      'kind', (
        select member_kind
        from public.match_lobby_members
        where lobby_id = p_lobby_id
          and user_id = uid
      )
    );
  end if;

  select
    exists (
      select 1
      from public.user_roles
      where user_id = uid
        and role in ('host','moderator','admin')
    ),
    exists (
      select 1
      from public.user_roles
      where user_id = uid
        and role = 'admin'
    )
    into is_staff, is_admin;

  select count(*)
    into total_count
  from public.match_lobby_members
  where lobby_id = p_lobby_id;

  select count(*)
    into player_count
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  if p_spectator then
    if not is_staff then
      raise exception 'STAFF_ONLY';
    end if;

    if total_count >= 12 and not is_admin then
      raise exception 'LOBBY_FULL';
    end if;

    result_kind := 'spectator';
  else
    if player_count >= 10 and not is_admin then
      raise exception 'PLAYER_SLOTS_FULL';
    end if;

    if total_count >= 12 and not is_admin then
      raise exception 'LOBBY_FULL';
    end if;

    result_kind := 'player';
  end if;

  insert into public.match_lobby_members (
    lobby_id,
    user_id,
    member_kind
  )
  values (
    p_lobby_id,
    uid,
    result_kind
  );

  if is_staff
     and result_kind = 'player'
     and host_id is null then

    update public.match_lobbies
    set host_user_id = uid,
        last_activity_at = now()
    where id = p_lobby_id;
  end if;

  select count(*)
    into player_count
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  if player_count >= 10 then
    perform public.mm_assign_teams(p_lobby_id);

    update public.match_lobbies
    set status = case
      when host_user_id is null then 'host_needed'
      else 'ready'
    end,
    last_activity_at = now()
    where id = p_lobby_id;

    if host_user_id is not null
       and selected_map is not null then
      perform public.mm_start_ready_check(p_lobby_id);
    end if;
  else
    update public.match_lobbies
    set status = 'searching',
        last_activity_at = now()
    where id = p_lobby_id;
  end if;

  update public.host_notifications
  set status = 'read'
  where lobby_id = p_lobby_id
    and host_user_id = uid
    and status = 'unread';

  return jsonb_build_object(
    'ok', true,
    'kind', result_kind
  );
end;
$$;

create or replace function public.mm_start_ready_check(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pc integer;
  host_id uuid;
  selected text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.match_lobby_members
    where lobby_id = p_lobby_id
      and user_id = uid
      and member_kind = 'player'
  ) then
    raise exception 'PLAYER_ONLY';
  end if;

  select count(*)
    into pc
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  select host_user_id, selected_map
    into host_id, selected
  from public.match_lobbies
  where id = p_lobby_id
  for update;

  if pc < 10 then
    raise exception 'NEED_10_PLAYERS';
  end if;

  if host_id is null then
    raise exception 'HOST_REQUIRED';
  end if;

  if selected is null then
    raise exception 'MAP_REQUIRED';
  end if;

  perform public.mm_assign_teams(p_lobby_id);

  update public.match_lobbies
  set status = 'in_game',
      last_activity_at = now()
  where id = p_lobby_id;

  return true;
end;
$$;

create or replace function public.mm_vote_map(
  p_lobby_id uuid,
  p_map_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  total_players integer;
  vote_count integer;
  winner text;
  host_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_map_name not in ('Mirage','Dust II','Nuke') then
    raise exception 'INVALID_MAP';
  end if;

  select count(*)
    into total_players
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  if total_players < 10 then
    raise exception 'NEED_10_PLAYERS';
  end if;

  if exists (
    select 1
    from public.match_lobbies
    where id = p_lobby_id
      and selected_map is not null
  ) then
    raise exception 'MAP_ALREADY_SELECTED';
  end if;

  if not exists (
    select 1
    from public.match_lobby_members
    where lobby_id = p_lobby_id
      and user_id = uid
      and member_kind = 'player'
  ) then
    raise exception 'PLAYER_ONLY';
  end if;

  insert into public.match_lobby_map_votes (
    lobby_id,
    user_id,
    map_name
  )
  values (
    p_lobby_id,
    uid,
    p_map_name
  )
  on conflict (lobby_id, user_id)
  do update set map_name = excluded.map_name;

  select map_name, count(*)::integer
    into winner, vote_count
  from public.match_lobby_map_votes
  where lobby_id = p_lobby_id
  group by map_name
  order by
    count(*) desc,
    case map_name
      when 'Mirage' then 1
      when 'Dust II' then 2
      else 3
    end
  limit 1;

  if vote_count >= 6 then
    select host_user_id
      into host_id
    from public.match_lobbies
    where id = p_lobby_id
    for update;

    update public.match_lobbies
    set selected_map = winner,
        last_activity_at = now()
    where id = p_lobby_id
      and selected_map is null;

    if host_id is not null then
      perform public.mm_start_ready_check(p_lobby_id);
    else
      update public.match_lobbies
      set status = 'host_needed',
          last_activity_at = now()
      where id = p_lobby_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'selected_map', (
      select selected_map
      from public.match_lobbies
      where id = p_lobby_id
    ),
    'votes', (
      select count(*)
      from public.match_lobby_map_votes
      where lobby_id = p_lobby_id
    )
  );
end;
$$;

create or replace function public.public_leaderboard(p_limit integer default 100)
returns table (
  id uuid,
  nickname text,
  elo integer,
  wins integer,
  losses integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nickname,
    p.elo,
    p.wins,
    p.losses
  from public.profiles p
  where not p.banned
     or (p.ban_until is not null and p.ban_until <= now())
  order by p.elo desc, p.wins desc, p.created_at asc
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;

create or replace function public.touch_presence()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.profiles
  set last_seen_at = now()
  where id = uid;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return true;
end;
$$;

revoke execute on function public.mm_create_lobby() from public, anon;
revoke execute on function public.mm_leave_lobby(uuid) from public, anon;
revoke execute on function public.mm_assign_teams(uuid) from public, anon;
revoke execute on function public.mm_join_lobby(uuid, boolean) from public, anon;
revoke execute on function public.mm_start_ready_check(uuid) from public, anon;
revoke execute on function public.mm_vote_map(uuid, text) from public, anon;
revoke execute on function public.public_leaderboard(integer) from public;
revoke execute on function public.touch_presence() from public, anon;

grant execute on function public.mm_create_lobby() to authenticated;
grant execute on function public.mm_leave_lobby(uuid) to authenticated;
grant execute on function public.mm_assign_teams(uuid) to authenticated;
grant execute on function public.mm_join_lobby(uuid, boolean) to authenticated;
grant execute on function public.mm_start_ready_check(uuid) to authenticated;
grant execute on function public.mm_vote_map(uuid, text) to authenticated;
grant execute on function public.public_leaderboard(integer) to anon, authenticated;
grant execute on function public.touch_presence() to authenticated;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Repair the security state reported by diagnostics as well.
-- ---------------------------------------------------------------------------

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke execute on function public.mm_search_lobby() from public, anon;
grant execute on function public.mm_search_lobby() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users admins and lobby members can read profiles" on public.profiles;

create policy "Users admins and lobby members can read profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or exists (
    select 1
    from public.match_lobby_members m
    where m.user_id = public.profiles.id
      and exists (
        select 1
        from public.match_lobby_members mine
        where mine.lobby_id = m.lobby_id
          and mine.user_id = (select auth.uid())
      )
  )
);

drop policy if exists "Admins update profiles" on public.profiles;

create policy "Admins update profiles"
on public.profiles
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "Staff read match results" on public.match_results;
drop policy if exists "Participants and staff read match results" on public.match_results;

create policy "Participants and staff read match results"
on public.match_results
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
  or submitted_by = (select auth.uid())
  or exists (
    select 1
    from public.match_lobby_members m
    where m.lobby_id = public.match_results.lobby_id
      and m.user_id = (select auth.uid())
      and m.member_kind = 'player'
  )
);

drop policy if exists "Staff read match result players" on public.match_result_players;
drop policy if exists "Participants and staff read result players" on public.match_result_players;

create policy "Participants and staff read result players"
on public.match_result_players
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
  or user_id = (select auth.uid())
  or exists (
    select 1
    from public.match_results r
    join public.match_lobby_members m
      on m.lobby_id = r.lobby_id
    where r.id = public.match_result_players.result_id
      and m.user_id = (select auth.uid())
      and m.member_kind = 'player'
  )
);

notify pgrst, 'reload schema';
