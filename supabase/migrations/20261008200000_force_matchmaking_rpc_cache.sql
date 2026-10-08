-- ReCorN: force-create the exact zero-argument matchmaking RPCs expected by PostgREST.
-- This is a NEW migration so it runs even if earlier matchmaking migrations
-- have already been recorded as applied.

drop function if exists public.mm_search_lobby();
drop function if exists public.mm_create_lobby();
drop function if exists public.mm_open_lobbies();

create function public.mm_search_lobby()
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

  if lobby_id is not null then
    return lobby_id;
  end if;

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
  order by l.created_at
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
    values (uid, 'searching', 10, 10, now(), now())
    returning id into lobby_id;

    insert into public.match_lobby_members (lobby_id,user_id,member_kind)
    values (lobby_id,uid,'player');
  else
    insert into public.match_lobby_members (lobby_id,user_id,member_kind)
    values (lobby_id,uid,'player')
    on conflict (lobby_id,user_id) do nothing;

    update public.match_lobbies
    set last_activity_at = now()
    where id = lobby_id;
  end if;

  select count(*)
  into member_count
  from public.match_lobby_members
  where match_lobby_members.lobby_id = lobby_id
    and member_kind = 'player';

  update public.match_lobbies
  set status = case
    when member_count >= 10 and host_user_id is not null then 'ready'
    when member_count >= 10 then 'host_needed'
    else 'searching'
  end,
  last_activity_at = now()
  where id = lobby_id;

  return lobby_id;
end;
$$;

create function public.mm_create_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lobby_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = uid
      and not p.banned
  ) then
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
  values (uid, 'waiting', 10, 10, now(), now())
  returning id into lobby_id;

  insert into public.match_lobby_members (lobby_id,user_id,member_kind)
  values (lobby_id,uid,'player');

  return lobby_id;
end;
$$;

create function public.mm_open_lobbies()
returns setof public.match_lobbies
language sql
security definer
set search_path = ''
as $$
  select l.*
  from public.match_lobbies l
  where l.status in ('waiting','searching','full','host_needed','ready')
  order by l.created_at desc
  limit 50
$$;

revoke execute on function public.mm_search_lobby() from public, anon;
revoke execute on function public.mm_create_lobby() from public, anon;
revoke execute on function public.mm_open_lobbies() from public, anon;

grant execute on function public.mm_search_lobby() to authenticated;
grant execute on function public.mm_create_lobby() to authenticated;
grant execute on function public.mm_open_lobbies() to authenticated;

notify pgrst, 'reload schema';
