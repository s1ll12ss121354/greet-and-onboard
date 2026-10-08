-- ReCorN: restore the RPCs used by the matchmaking page.
-- IMPORTANT: PostgREST resolves functions by exact signature. We explicitly
-- remove stale overloads and recreate the zero-argument functions expected by
-- supabase.rpc("mm_search_lobby") / supabase.rpc("mm_create_lobby").

drop function if exists public.mm_search_lobby();
drop function if exists public.mm_create_lobby();
drop function if exists public.mm_open_lobbies();

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

  -- Never create a second active lobby for the same player.
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

  -- Prefer an existing searching lobby whose ELO is within the current
  -- expanding range. The lobby target is 10 players for the 5v5 flow.
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
    and (
      select coalesce(avg(p2.elo), player_elo)
      from public.match_lobby_members m2
      join public.profiles p2 on p2.id = m2.user_id
      where m2.lobby_id = l.id
        and m2.member_kind = 'player'
    ) between
      player_elo - 100 - (
        300 * floor(extract(epoch from (now() - l.search_started_at)) / 60)
      )
      and
      player_elo + 500 + (
        500 * floor(extract(epoch from (now() - l.search_started_at)) / 60)
      )
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
    values (
      uid,
      'searching',
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
  else
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

    update public.match_lobbies
    set last_activity_at = now()
    where id = lobby_id;
  end if;

  select count(*)
    into member_count
  from public.match_lobby_members m
  where m.lobby_id = lobby_id
    and m.member_kind = 'player';

  if member_count >= 10 then
    update public.match_lobbies
    set status = case
      when host_user_id is null then 'host_needed'
      else 'ready'
    end,
    last_activity_at = now()
    where id = lobby_id;
  else
    update public.match_lobbies
    set status = 'searching',
        last_activity_at = now()
    where id = lobby_id;
  end if;

  return lobby_id;
end;
$$;

create or replace function public.mm_create_lobby()
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

  -- Reuse the player's existing active lobby instead of creating duplicates.
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

create or replace function public.mm_open_lobbies()
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

-- Force PostgREST to refresh its function/schema cache after the migration.
notify pgrst, 'reload schema';
