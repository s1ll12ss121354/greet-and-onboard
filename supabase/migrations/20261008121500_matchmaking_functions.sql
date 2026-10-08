create or replace function public.mm_create_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); lobby_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=uid and not banned) then raise exception 'PROFILE_REQUIRED'; end if;
  select lm.lobby_id into lobby_id
  from public.match_lobby_members lm
  join public.match_lobbies l on l.id=lm.lobby_id
  where lm.user_id=uid and l.status in ('waiting','searching','full','host_needed','ready')
  order by lm.joined_at desc limit 1;
  if lobby_id is not null then return lobby_id; end if;
  insert into public.match_lobbies(creator_id,status) values(uid,'waiting') returning id into lobby_id;
  insert into public.match_lobby_members(lobby_id,user_id,member_kind) values(lobby_id,uid,'player');
  return lobby_id;
end;
$$;

create or replace function public.mm_open_lobbies()
returns table(
  id uuid,
  status text,
  creator_id uuid,
  player_count bigint,
  spectator_count bigint,
  search_started_at timestamptz,
  host_user_id uuid
)
language sql
security definer
set search_path = ''
as $$
  select l.id, l.status, l.creator_id,
    count(*) filter (where m.member_kind='player') as player_count,
    count(*) filter (where m.member_kind='spectator') as spectator_count,
    l.search_started_at, l.host_user_id
  from public.match_lobbies l
  left join public.match_lobby_members m on m.lobby_id=l.id
  where l.status in ('waiting','searching','full','host_needed','ready')
  group by l.id
  order by l.created_at desc
  limit 30
$$;

create or replace function public.mm_search_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  player_elo integer;
  existing_lobby uuid;
  found_lobby uuid;
  wait_minutes integer;
  elo_low integer;
  elo_high integer;
  member_count integer;
  assigned_host uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select p.elo into player_elo
  from public.profiles p where p.id=uid and not p.banned;
  if player_elo is null then raise exception 'PROFILE_REQUIRED'; end if;

  select lm.lobby_id into existing_lobby
  from public.match_lobby_members lm
  join public.match_lobbies l on l.id=lm.lobby_id
  where lm.user_id=uid and l.status in ('waiting','searching','full','host_needed','ready')
  order by lm.joined_at desc limit 1;
  if existing_lobby is not null then return existing_lobby; end if;

  select l.id into found_lobby
  from public.match_lobbies l
  where l.status in ('waiting','searching')
    and l.search_started_at >= now() - interval '30 minutes'
    and (select count(*) from public.match_lobby_members m where m.lobby_id=l.id and m.member_kind='player') < l.target_players
    and player_elo between
      greatest(0, (
        select avg(p2.elo) - 100 - 300 * floor(extract(epoch from (now()-l.search_started_at))/60)
        from public.match_lobby_members m2 join public.profiles p2 on p2.id=m2.user_id
        where m2.lobby_id=l.id and m2.member_kind='player'
      ))
      and (
        select avg(p3.elo) + 500 + 500 * floor(extract(epoch from (now()-l.search_started_at))/60)
        from public.match_lobby_members m3 join public.profiles p3 on p3.id=m3.user_id
        where m3.lobby_id=l.id and m3.member_kind='player'
      )
  order by abs(player_elo - coalesce((
    select avg(p4.elo) from public.match_lobby_members m4 join public.profiles p4 on p4.id=m4.user_id
    where m4.lobby_id=l.id and m4.member_kind='player'
  ),player_elo)), l.created_at
  limit 1;

  if found_lobby is null then
    insert into public.match_lobbies(creator_id,status) values(uid,'searching') returning id into found_lobby;
    insert into public.match_lobby_members(lobby_id,user_id,member_kind) values(found_lobby,uid,'player');
  else
    insert into public.match_lobby_members(lobby_id,user_id,member_kind)
    values(found_lobby,uid,'player') on conflict(lobby_id,user_id) do nothing;
  end if;

  select count(*) into member_count from public.match_lobby_members
  where lobby_id=found_lobby and member_kind='player';

  if member_count >= 5 then
    select m.user_id into assigned_host
    from public.match_lobby_members m
    join public.user_roles r on r.user_id=m.user_id
    where m.lobby_id=found_lobby and m.member_kind='player'
      and r.role in ('host','moderator','admin')
    order by case r.role when 'host' then 1 when 'moderator' then 2 else 3 end
    limit 1;

    update public.match_lobbies
    set host_user_id=assigned_host,
        status=case when assigned_host is null then 'host_needed' else 'ready' end,
        last_activity_at=now()
    where id=found_lobby;

    if assigned_host is null then
      insert into public.host_notifications(lobby_id,host_user_id,message)
      select found_lobby,ur.user_id,'Лобби ReCorN заполнено 5/5. Зайдите в лобби как хост.'
      from public.user_roles ur
      join public.profiles hp on hp.id=ur.user_id
      where ur.role in ('host','moderator','admin')
        and hp.last_seen_at > now()-interval '2 minutes'
        and ur.user_id <> uid
        and not exists(select 1 from public.match_lobby_members mm where mm.lobby_id=found_lobby and mm.user_id=ur.user_id)
        and not exists(select 1 from public.host_notifications hn where hn.lobby_id=found_lobby and hn.host_user_id=ur.user_id and hn.status='unread');
    end if;
  else
    update public.match_lobbies set status='searching',last_activity_at=now() where id=found_lobby;
  end if;

  return found_lobby;
end;
$$;

revoke execute on function public.mm_create_lobby() from public,anon;
revoke execute on function public.mm_open_lobbies() from public,anon;
grant execute on function public.mm_create_lobby() to authenticated;
grant execute on function public.mm_open_lobbies() to authenticated;