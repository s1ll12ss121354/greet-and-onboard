-- ReCorN: bug fixes found during full security/flow audit.
-- 1) Safe public leaderboard without exposing profile flags.
-- 2) Remove the exposed helper overload that accepted an arbitrary user_id.
-- 3) Stop matches getting stuck in ready_check now that READY UI is hidden.
-- 4) Assign teams and discover/notify hosts when matchmaking reaches 10 players.

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

revoke all on function public.public_leaderboard(integer) from public;
grant execute on function public.public_leaderboard(integer) to anon, authenticated;

-- The previous helper accepted an arbitrary p_user_id, which let any
-- authenticated caller test membership of another user. Replace it with
-- a current-user-only helper used only inside RLS.
drop policy if exists "Lobby members can read their lobby" on public.match_lobbies;
drop policy if exists "Lobby members can read lobby roster" on public.match_lobby_members;
drop policy if exists "Lobby members can read map votes" on public.match_lobby_map_votes;

drop function if exists public.is_recorn_lobby_member(uuid, uuid);

create or replace function public.is_recorn_lobby_member(p_lobby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.match_lobby_members m
      where m.lobby_id = p_lobby_id
        and m.user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_recorn_lobby_member(uuid) from public, anon;
grant execute on function public.is_recorn_lobby_member(uuid) to authenticated;

create policy "Lobby members can read their lobby"
on public.match_lobbies
for select
to authenticated
using (
  status <> 'cancelled'
  and (
    creator_id = (select auth.uid())
    or public.is_recorn_lobby_member(id)
  )
);

create policy "Lobby members can read lobby roster"
on public.match_lobby_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_recorn_lobby_member(lobby_id)
);

create policy "Lobby members can read map votes"
on public.match_lobby_map_votes
for select
to authenticated
using (
  public.is_recorn_lobby_member(lobby_id)
);

-- No visible READY button exists in the current client. A ready_check would
-- therefore deadlock a normal match. Keep the RPC name for compatibility,
-- but complete the flow immediately once the host + map + 10 players exist.
create or replace function public.mm_start_ready_check(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
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

  select count(*) into pc
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

-- Repair lobbies that were already stuck by the previous ready_check flow.
update public.match_lobbies l
set status = 'in_game',
    last_activity_at = now()
where l.status = 'ready_check'
  and l.host_user_id is not null
  and l.selected_map is not null
  and (
    select count(*)
    from public.match_lobby_members m
    where m.lobby_id = l.id
      and m.member_kind = 'player'
  ) >= 10;

-- Replace matchmaking search with a version that also assigns teams and
-- discovers/alerts a host when the lobby reaches 10 players.
create or replace function public.mm_search_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  player_elo integer;
  lobby_id uuid;
  member_count integer;
  assigned_host uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.elo
    into player_elo
  from public.profiles p
  where p.id = uid
    and not p.banned;

  if player_elo is null then
    raise exception 'PROFILE_REQUIRED';
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

  if lobby_id is null then
    select l.id
      into lobby_id
    from public.match_lobbies l
    where l.status in ('waiting','searching')
      and l.search_started_at >= now() - interval '30 minutes'
      and (
        select count(*)
        from public.match_lobby_members m
        where m.lobby_id = l.id
          and m.member_kind = 'player'
      ) < l.target_players
      and player_elo between
        greatest(
          0,
          (
            select coalesce(avg(p2.elo), player_elo)
            from public.match_lobby_members m2
            join public.profiles p2 on p2.id = m2.user_id
            where m2.lobby_id = l.id
              and m2.member_kind = 'player'
          ) - 500
        )
        and
        (
          select coalesce(avg(p3.elo), player_elo)
          from public.match_lobby_members m3
          join public.profiles p3 on p3.id = m3.user_id
          where m3.lobby_id = l.id
            and m3.member_kind = 'player'
        ) + 500
    order by abs(
      player_elo - coalesce(
        (
          select avg(p4.elo)
          from public.match_lobby_members m4
          join public.profiles p4 on p4.id = m4.user_id
          where m4.lobby_id = l.id
            and m4.member_kind = 'player'
        ),
        player_elo
      )
    ), l.created_at
    limit 1;

    if lobby_id is null then
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
        'searching',
        10,
        10,
        now(),
        now()
      )
      returning id into lobby_id;
    end if;

    insert into public.match_lobby_members (
      lobby_id,
      user_id,
      member_kind
    )
    values (
      lobby_id,
      uid,
      'player'
    )
    on conflict (lobby_id, user_id) do nothing;
  end if;

  select count(*)
    into member_count
  from public.match_lobby_members
  where lobby_id = lobby_id
    and member_kind = 'player';

  if member_count >= 10 then
    perform public.mm_assign_teams(lobby_id);

    select m.user_id
      into assigned_host
    from public.match_lobby_members m
    join public.user_roles r
      on r.user_id = m.user_id
    where m.lobby_id = lobby_id
      and m.member_kind = 'player'
      and r.role in (
        'host'::public.app_role,
        'moderator'::public.app_role,
        'admin'::public.app_role
      )
    order by
      case r.role
        when 'host'::public.app_role then 1
        when 'moderator'::public.app_role then 2
        when 'admin'::public.app_role then 3
        else 4
      end,
      m.joined_at
    limit 1;

    update public.match_lobbies
    set host_user_id = coalesce(host_user_id, assigned_host),
        status = case
          when coalesce(host_user_id, assigned_host) is null then 'host_needed'
          else 'ready'
        end,
        last_activity_at = now()
    where id = lobby_id;

    if not exists (
      select 1
      from public.match_lobbies
      where id = lobby_id
        and host_user_id is not null
    ) then
      insert into public.host_notifications (
        lobby_id,
        host_user_id,
        message
      )
      select
        lobby_id,
        ur.user_id,
        'Лобби ReCorN заполнено 10/10. Зайдите в лобби как хост.'
      from public.user_roles ur
      join public.profiles hp
        on hp.id = ur.user_id
      where ur.role in (
        'host'::public.app_role,
        'moderator'::public.app_role,
        'admin'::public.app_role
      )
        and hp.last_seen_at > now() - interval '2 minutes'
        and not exists (
          select 1
          from public.match_lobby_members mm
          where mm.lobby_id = lobby_id
            and mm.user_id = ur.user_id
        )
        and not exists (
          select 1
          from public.host_notifications hn
          where hn.lobby_id = lobby_id
            and hn.host_user_id = ur.user_id
            and hn.status = 'unread'
        );
    end if;
  else
    update public.match_lobbies
    set status = 'searching',
        last_activity_at = now()
    where id = lobby_id
      and status not in ('in_game','cancelled');
  end if;

  return lobby_id;
end;
$$;

revoke execute on function public.mm_search_lobby() from public, anon;
grant execute on function public.mm_search_lobby() to authenticated;

-- Rework map voting so a successful map selection actually starts the game
-- through the same safe host/teams path instead of deadlocking at ready_check.
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
  uid uuid := auth.uid();
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

revoke execute on function public.mm_start_ready_check(uuid) from public, anon;
revoke execute on function public.mm_vote_map(uuid, text) from public, anon;
grant execute on function public.mm_start_ready_check(uuid) to authenticated;
grant execute on function public.mm_vote_map(uuid, text) to authenticated;

notify pgrst, 'reload schema';