-- ReCorN match results: host submits the result screenshot and K/D for each player.
-- ELO is calculated server-side from K/D and win/loss, so clients cannot forge ratings.

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

revoke all on public.match_results from anon, authenticated;
revoke all on public.match_result_players from anon, authenticated;
grant select on public.match_results to authenticated;
grant select on public.match_result_players to authenticated;

drop policy if exists "Staff read match results" on public.match_results;
create policy "Staff read match results"
on public.match_results for select to authenticated
using (
  public.has_role((select auth.uid()), 'host')
  or public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
);

drop policy if exists "Staff read match result players" on public.match_result_players;
create policy "Staff read match result players"
on public.match_result_players for select to authenticated
using (
  public.has_role((select auth.uid()), 'host')
  or public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
);

-- Private bucket for match screenshots. Storage policies below restrict uploads to staff.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-screenshots', 'match-screenshots', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Host can upload match screenshots" on storage.objects;
create policy "Host can upload match screenshots"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'match-screenshots'
  and (public.has_role((select auth.uid()), 'host')
       or public.has_role((select auth.uid()), 'moderator')
       or public.has_role((select auth.uid()), 'admin'))
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Staff can read match screenshots" on storage.objects;
create policy "Staff can read match screenshots"
on storage.objects for select to authenticated
using (
  bucket_id = 'match-screenshots'
  and (
    owner_id = (select auth.uid())::text
    or public.has_role((select auth.uid()), 'moderator')
    or public.has_role((select auth.uid()), 'admin')
  )
);

create or replace function public.submit_match_result(
  p_lobby_id uuid,
  p_screenshot_path text,
  p_players jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result_id uuid;
  lobby_host uuid;
  lobby_status text;
  item jsonb;
  player_id uuid;
  kills integer;
  deaths integer;
  won boolean;
  kd numeric;
  delta integer;
  base_delta integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select host_user_id, status
    into lobby_host, lobby_status
  from public.match_lobbies
  where id = p_lobby_id
  for update;

  if lobby_host is null or lobby_host <> uid then
    raise exception 'HOST_ONLY';
  end if;
  if lobby_status not in ('ready','in_game','full','host_needed') then
    raise exception 'MATCH_NOT_READY';
  end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) < 2 then
    raise exception 'INVALID_RESULT';
  end if;
  if exists(select 1 from public.match_results where lobby_id = p_lobby_id) then
    raise exception 'RESULT_ALREADY_SUBMITTED';
  end if;

  insert into public.match_results(lobby_id, submitted_by, screenshot_path)
  values (p_lobby_id, uid, nullif(left(coalesce(p_screenshot_path,''), 500), ''))
  returning id into result_id;

  for item in select * from jsonb_array_elements(p_players)
  loop
    player_id := (item->>'user_id')::uuid;
    kills := greatest(0, least(999, coalesce((item->>'kills')::integer, 0)));
    deaths := greatest(0, least(999, coalesce((item->>'deaths')::integer, 0)));
    won := coalesce((item->>'won')::boolean, false);

    if not exists (
      select 1 from public.match_lobby_members
      where lobby_id = p_lobby_id and user_id = player_id and member_kind = 'player'
    ) then
      raise exception 'PLAYER_NOT_IN_LOBBY';
    end if;

    kd := round((kills::numeric / greatest(deaths, 1)::numeric), 3);
    base_delta := case when won then 20 else -20 end;
    delta := greatest(-50, least(50, base_delta + round(greatest(-2, least(2, kd - 1)) * 10)::integer));

    insert into public.match_result_players(result_id,user_id,kills,deaths,won,kd,elo_delta)
    values(result_id,player_id,kills,deaths,won,kd,delta);

    update public.profiles
    set elo = greatest(0, elo + delta),
        wins = wins + case when won then 1 else 0 end,
        losses = losses + case when won then 0 else 1 end
    where id = player_id;
  end loop;

  if (select count(*) from public.match_result_players where result_id = result_id)
     <> (select count(*) from public.match_lobby_members where lobby_id = p_lobby_id and member_kind = 'player') then
    raise exception 'RESULT_MISSING_PLAYERS';
  end if;

  update public.match_lobbies
  set status = 'cancelled', last_activity_at = now()
  where id = p_lobby_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'match_result_submitted','/matchmaking',
    jsonb_build_object('lobby_id',p_lobby_id,'result_id',result_id));

  return result_id;
exception
  when others then
    if result_id is not null then
      delete from public.match_results where id = result_id;
    end if;
    raise;
end;
$$;

revoke execute on function public.submit_match_result(uuid,text,jsonb) from public, anon;
grant execute on function public.submit_match_result(uuid,text,jsonb) to authenticated;

-- Temporary bans must expire correctly in matchmaking.
create or replace function public.mm_create_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); lobby_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=uid and not public.is_active_ban(uid)) then raise exception 'PROFILE_REQUIRED'; end if;
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

create or replace function public.mm_search_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); player_elo integer; existing_lobby uuid; found_lobby uuid; member_count integer; assigned_host uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.elo into player_elo from public.profiles p where p.id=uid and not public.is_active_ban(uid);
  if player_elo is null then raise exception 'PROFILE_REQUIRED'; end if;

  select lm.lobby_id into existing_lobby
  from public.match_lobby_members lm join public.match_lobbies l on l.id=lm.lobby_id
  where lm.user_id=uid and l.status in ('waiting','searching','full','host_needed','ready')
  order by lm.joined_at desc limit 1;
  if existing_lobby is not null then return existing_lobby; end if;

  select l.id into found_lobby
  from public.match_lobbies l
  where l.status in ('waiting','searching')
    and l.search_started_at >= now()-interval '30 minutes'
    and (select count(*) from public.match_lobby_members m where m.lobby_id=l.id and m.member_kind='player') < l.target_players
    and player_elo between
      greatest(0,(select avg(p2.elo)-100-300*floor(extract(epoch from(now()-l.search_started_at))/60)
        from public.match_lobby_members m2 join public.profiles p2 on p2.id=m2.user_id
        where m2.lobby_id=l.id and m2.member_kind='player'))
      and
      (select avg(p3.elo)+500+500*floor(extract(epoch from(now()-l.search_started_at))/60)
        from public.match_lobby_members m3 join public.profiles p3 on p3.id=m3.user_id
        where m3.lobby_id=l.id and m3.member_kind='player')
  order by abs(player_elo-coalesce((select avg(p4.elo) from public.match_lobby_members m4 join public.profiles p4 on p4.id=m4.user_id where m4.lobby_id=l.id and m4.member_kind='player'),player_elo)),l.created_at
  limit 1;

  if found_lobby is null then
    insert into public.match_lobbies(creator_id,status) values(uid,'searching') returning id into found_lobby;
    insert into public.match_lobby_members(lobby_id,user_id,member_kind) values(found_lobby,uid,'player');
  else
    insert into public.match_lobby_members(lobby_id,user_id,member_kind) values(found_lobby,uid,'player') on conflict(lobby_id,user_id) do nothing;
  end if;

  select count(*) into member_count from public.match_lobby_members where lobby_id=found_lobby and member_kind='player';
  if member_count >= 5 then
    select m.user_id into assigned_host from public.match_lobby_members m join public.user_roles r on r.user_id=m.user_id
    where m.lobby_id=found_lobby and m.member_kind='player' and r.role in ('host','moderator','admin')
    order by case r.role when 'host' then 1 when 'moderator' then 2 else 3 end limit 1;
    update public.match_lobbies set host_user_id=assigned_host,status=case when assigned_host is null then 'host_needed' else 'ready' end,last_activity_at=now() where id=found_lobby;
    if assigned_host is null then
      insert into public.host_notifications(lobby_id,host_user_id,message)
      select found_lobby,ur.user_id,'Лобби ReCorN заполнено 5/5. Зайдите в лобби как хост.'
      from public.user_roles ur join public.profiles hp on hp.id=ur.user_id
      where ur.role in ('host','moderator','admin') and hp.last_seen_at>now()-interval '2 minutes'
        and ur.user_id<>uid and not exists(select 1 from public.match_lobby_members mm where mm.lobby_id=found_lobby and mm.user_id=ur.user_id)
        and not exists(select 1 from public.host_notifications hn where hn.lobby_id=found_lobby and hn.host_user_id=ur.user_id and hn.status='unread');
    end if;
  else
    update public.match_lobbies set status='searching',last_activity_at=now() where id=found_lobby;
  end if;
  return found_lobby;
end;
$$;

revoke execute on function public.mm_create_lobby() from public,anon;
revoke execute on function public.mm_search_lobby() from public,anon;
grant execute on function public.mm_create_lobby() to authenticated;
grant execute on function public.mm_search_lobby() to authenticated;
