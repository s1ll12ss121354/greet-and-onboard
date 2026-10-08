-- ReCorN matchmaking, host contacts, language/security metadata
create extension if not exists pgcrypto;

alter table public.host_applications
  add column if not exists discord_contact text,
  add column if not exists telegram_contact text;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create unique index if not exists profiles_nickname_unique_ci
  on public.profiles (lower(trim(nickname)));

create table if not exists public.match_lobbies (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'searching'
    check (status in ('waiting','searching','full','host_needed','ready','in_game','cancelled')),
  target_players integer not null default 5 check (target_players between 1 and 10),
  max_players integer not null default 10 check (max_players between 1 and 10),
  search_started_at timestamptz not null default now(),
  host_user_id uuid references auth.users(id) on delete set null,
  host_needed_notified_at timestamptz,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.match_lobby_members (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_kind text not null default 'player' check (member_kind in ('player','spectator')),
  joined_at timestamptz not null default now(),
  unique (lobby_id, user_id)
);

create table if not exists public.host_notifications (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  status text not null default 'unread' check (status in ('unread','read','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.security_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_category text not null check (device_category in ('mobile','tablet','desktop','unknown')),
  browser text,
  os text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists match_lobbies_status_started_idx
  on public.match_lobbies(status, search_started_at);
create index if not exists match_lobby_members_lobby_idx
  on public.match_lobby_members(lobby_id, member_kind);
create index if not exists match_lobby_members_user_idx
  on public.match_lobby_members(user_id);
create index if not exists host_notifications_user_status_idx
  on public.host_notifications(host_user_id, status, created_at desc);
create index if not exists security_login_events_user_created_idx
  on public.security_login_events(user_id, created_at desc);

alter table public.match_lobbies enable row level security;
alter table public.match_lobby_members enable row level security;
alter table public.host_notifications enable row level security;
alter table public.security_login_events enable row level security;

drop policy if exists "Authenticated users can read active lobbies" on public.match_lobbies;
create policy "Authenticated users can read active lobbies"
on public.match_lobbies for select to authenticated
using (
  status <> 'cancelled'
  and (
    creator_id = (select auth.uid())
    or exists (
      select 1 from public.match_lobby_members m
      where m.lobby_id = match_lobbies.id and m.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Members can read lobby members" on public.match_lobby_members;
create policy "Members can read lobby members"
on public.match_lobby_members for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.match_lobby_members mine
    where mine.lobby_id = match_lobby_members.lobby_id
      and mine.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read own host notifications" on public.host_notifications;
create policy "Users can read own host notifications"
on public.host_notifications for select to authenticated
using (host_user_id = (select auth.uid()));

drop policy if exists "Users can update own host notifications" on public.host_notifications;
create policy "Users can update own host notifications"
on public.host_notifications for update to authenticated
using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));

drop policy if exists "Users can read own login events" on public.security_login_events;
create policy "Users can read own login events"
on public.security_login_events for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own login events" on public.security_login_events;
create policy "Users can insert own login events"
on public.security_login_events for insert to authenticated
with check (user_id = (select auth.uid()));

-- Host application contacts: at least one contact is required.
alter table public.host_applications
  drop constraint if exists host_application_contact_check;
alter table public.host_applications
  add constraint host_application_contact_check
  check (
    nullif(trim(discord_contact), '') is not null
    or nullif(trim(telegram_contact), '') is not null
  );

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
  minute_wait integer;
  elo_low integer;
  elo_high integer;
  member_count integer;
  avg_elo numeric;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.elo into player_elo
  from public.profiles p
  where p.id = uid and not p.banned;

  if player_elo is null then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select lm.lobby_id into existing_lobby
  from public.match_lobby_members lm
  join public.match_lobbies l on l.id = lm.lobby_id
  where lm.user_id = uid
    and l.status in ('waiting','searching','full','host_needed','ready')
  order by lm.joined_at desc
  limit 1;

  if existing_lobby is not null then
    return existing_lobby;
  end if;

  minute_wait := 0;
  elo_low := greatest(0, player_elo - 100);
  elo_high := player_elo + 500;

  select l.id
    into found_lobby
  from public.match_lobbies l
  where l.status in ('waiting','searching')
    and l.search_started_at >= now() - interval '30 minutes'
    and (
      select count(*) from public.match_lobby_members m
      where m.lobby_id = l.id and m.member_kind = 'player'
    ) < l.target_players
    and player_elo between
      greatest(0, (
        select min(p2.elo) from public.match_lobby_members m2
        join public.profiles p2 on p2.id = m2.user_id
        where m2.lobby_id = l.id and m2.member_kind = 'player'
      ) - 500)
      and (
        select max(p3.elo) from public.match_lobby_members m3
        join public.profiles p3 on p3.id = m3.user_id
        where m3.lobby_id = l.id and m3.member_kind = 'player'
      ) + 500
  order by abs(player_elo - coalesce((
    select avg(p4.elo) from public.match_lobby_members m4
    join public.profiles p4 on p4.id = m4.user_id
    where m4.lobby_id = l.id and m4.member_kind = 'player'
  ), player_elo)), l.created_at
  limit 1;

  if found_lobby is null then
    insert into public.match_lobbies (creator_id, status)
    values (uid, 'searching')
    returning id into found_lobby;

    insert into public.match_lobby_members (lobby_id, user_id, member_kind)
    values (found_lobby, uid, 'player');
  else
    select floor(extract(epoch from (now() - l.search_started_at)) / 60)::integer
      into minute_wait
    from public.match_lobbies l where l.id = found_lobby;

    elo_low := greatest(0, player_elo - 100 - (300 * minute_wait));
    elo_high := player_elo + 500 + (500 * minute_wait);

    select count(*) into member_count
    from public.match_lobby_members m
    where m.lobby_id = found_lobby and m.member_kind = 'player';

    if member_count < 5 then
      insert into public.match_lobby_members (lobby_id, user_id, member_kind)
      values (found_lobby, uid, 'player')
      on conflict (lobby_id, user_id) do nothing;
    end if;
  end if;

  select count(*) into member_count
  from public.match_lobby_members m
  where m.lobby_id = found_lobby and m.member_kind = 'player';

  if member_count >= 5 then
    update public.match_lobbies
    set status = case
      when host_user_id is not null then 'ready'
      else 'host_needed'
    end,
    last_activity_at = now()
    where id = found_lobby;

    if not exists (
      select 1 from public.match_lobby_members m
      join public.user_roles r on r.user_id = m.user_id
      where m.lobby_id = found_lobby
        and m.member_kind = 'player'
        and r.role in ('host','moderator','admin')
    ) then
      insert into public.host_notifications (lobby_id, host_user_id, message)
      select found_lobby, ur.user_id,
        'Лобби ReCorN заполнено 5/5. Зайдите в лобби как хост.'
      from public.user_roles ur
      join public.profiles hp on hp.id = ur.user_id
      where ur.role in ('host','moderator','admin')
        and hp.last_seen_at > now() - interval '2 minutes'
        and not exists (
          select 1 from public.match_lobby_members mm
          where mm.lobby_id = found_lobby and mm.user_id = ur.user_id
        )
        and not exists (
          select 1 from public.host_notifications hn
          where hn.lobby_id = found_lobby and hn.host_user_id = ur.user_id and hn.status = 'unread'
        );
    end if;
  else
    update public.match_lobbies
    set status = 'searching', last_activity_at = now()
    where id = found_lobby;
  end if;

  return found_lobby;
end;
$$;

create or replace function public.mm_join_lobby(p_lobby_id uuid, p_spectator boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  is_host_plus boolean;
  is_admin boolean;
  total_count integer;
  player_count integer;
  result_kind text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select exists(select 1 from public.user_roles where user_id = uid and role in ('host','moderator','admin')),
         exists(select 1 from public.user_roles where user_id = uid and role = 'admin')
    into is_host_plus, is_admin;

  select count(*) into total_count from public.match_lobby_members where lobby_id = p_lobby_id;
  select count(*) into player_count from public.match_lobby_members where lobby_id = p_lobby_id and member_kind = 'player';

  if not exists(select 1 from public.match_lobbies where id = p_lobby_id and status <> 'cancelled') then
    raise exception 'LOBBY_NOT_FOUND';
  end if;

  if exists(select 1 from public.match_lobby_members where lobby_id = p_lobby_id and user_id = uid) then
    return jsonb_build_object('ok', true, 'kind',
      (select member_kind from public.match_lobby_members where lobby_id = p_lobby_id and user_id = uid));
  end if;

  if p_spectator then
    if not is_host_plus then raise exception 'STAFF_ONLY'; end if;
    if total_count >= 10 and not is_admin then
      raise exception 'LOBBY_FULL';
    end if;
    result_kind := 'spectator';
  else
    if player_count >= 5 and not is_admin then
      raise exception 'PLAYER_SLOTS_FULL';
    end if;
    if total_count >= 10 and not is_admin then
      raise exception 'LOBBY_FULL';
    end if;
    result_kind := 'player';
  end if;

  insert into public.match_lobby_members(lobby_id,user_id,member_kind)
  values(p_lobby_id,uid,result_kind);

  if is_host_plus then
    update public.match_lobbies
    set host_user_id = case when is_admin then host_user_id else uid end,
        status = case when player_count + (case when result_kind='player' then 1 else 0 end) >= 5 then 'ready' else status end,
        last_activity_at = now()
    where id = p_lobby_id;
  end if;

  update public.host_notifications
  set status = 'read'
  where lobby_id = p_lobby_id and host_user_id = uid and status = 'unread';

  return jsonb_build_object('ok', true, 'kind', result_kind);
end;
$$;

create or replace function public.mm_leave_lobby(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  remaining_players integer;
begin
  delete from public.match_lobby_members
  where lobby_id = p_lobby_id and user_id = uid;

  select count(*) into remaining_players
  from public.match_lobby_members
  where lobby_id = p_lobby_id and member_kind = 'player';

  update public.match_lobbies
  set status = case when remaining_players = 0 then 'cancelled'
                    when remaining_players < 5 then 'searching'
                    when host_user_id is null then 'host_needed'
                    else 'ready' end,
      host_user_id = case when host_user_id = uid then null else host_user_id end,
      last_activity_at = now()
  where id = p_lobby_id;

  return true;
end;
$$;

revoke execute on function public.mm_search_lobby() from public, anon;
revoke execute on function public.mm_join_lobby(uuid, boolean) from public, anon;
revoke execute on function public.mm_leave_lobby(uuid) from public, anon;
grant execute on function public.mm_search_lobby() to authenticated;
grant execute on function public.mm_join_lobby(uuid, boolean) to authenticated;
grant execute on function public.mm_leave_lobby(uuid) to authenticated;
