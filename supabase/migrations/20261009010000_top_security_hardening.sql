-- ReCorN: top-level security hardening.
--
-- Goals:
-- 1) Bind owner privileges to an immutable user id, not a nickname.
-- 2) Make public.has_role / is_active_ban safe against arbitrary-user lookup.
-- 3) Restrict direct profiles reads to self/admin/lobby members.
-- 4) Move normal presence updates behind an authenticated RPC.
-- 5) Remove unnecessary direct table DML grants.
-- 6) Close matchmaking race conditions with row locks.
-- 7) Make match-result submission prove the screenshot belongs to the host,
--    require a real result, and prevent mixed winners inside the same team.
-- 8) Add server-side anti-spam limits for reports and host applications.
-- 9) Keep public leaderboard available through a safe RPC.

-- ---------------------------------------------------------------------------
-- Owner identity lock
-- ---------------------------------------------------------------------------

create table if not exists public.recorn_owner_lock (
  user_id uuid primary key references auth.users(id) on delete restrict,
  locked_at timestamptz not null default now()
);

alter table public.recorn_owner_lock enable row level security;

revoke all on public.recorn_owner_lock from public, anon, authenticated;

insert into public.recorn_owner_lock (user_id)
select p.id
from public.profiles p
where lower(trim(p.nickname)) = 'isy_hesy09'
on conflict (user_id) do nothing;

create or replace function public.is_recorn_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recorn_owner_lock o
    where o.user_id = p_user_id
  );
$$;

revoke all on function public.is_recorn_owner(uuid) from public, anon, authenticated;

create or replace function public.protect_recorn_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.recorn_owner_lock o
    where o.user_id = old.id
  ) and new.nickname is distinct from old.nickname then
    raise exception 'OWNER_NICKNAME_LOCKED';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_recorn_owner_profile on public.profiles;

create trigger protect_recorn_owner_profile
before update on public.profiles
for each row
execute function public.protect_recorn_owner_profile();

-- ---------------------------------------------------------------------------
-- Role / ban lookup hardening
-- ---------------------------------------------------------------------------

create or replace function public.has_role(
  _user_id uuid,
  _role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    _user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_roles
      where user_id = _user_id
        and role = _role
    );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create or replace function public.is_active_ban(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select
    p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where id = p_user_id
        and banned = true
    );
$;

revoke execute on function public.is_active_ban(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: direct Data API access is limited to the user, admins,
-- or members of the same lobby.
-- Public ranking goes through public_leaderboard().
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

revoke select on public.profiles from anon;
grant select, update on public.profiles to authenticated;

drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;

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

-- ---------------------------------------------------------------------------
-- Presence: no client-side direct profile UPDATE is needed for this.
-- ---------------------------------------------------------------------------

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

revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- ---------------------------------------------------------------------------
-- Anti-spam helper for user-generated moderation requests.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_action_rate_limit(
  p_action text,
  p_window_seconds integer,
  p_max_requests integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  started timestamptz;
  current_count integer;
  window_size interval;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_action is null
     or char_length(trim(p_action)) = 0
     or char_length(p_action) > 64
     or p_window_seconds <= 0
     or p_max_requests <= 0 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;

  window_size := make_interval(secs => p_window_seconds);

  select window_started_at, request_count
    into started, current_count
  from public.security_rate_limits
  where user_id = uid
    and action = p_action
  for update;

  if started is null or started <= now() - window_size then
    insert into public.security_rate_limits (
      user_id,
      action,
      window_started_at,
      request_count
    )
    values (
      uid,
      p_action,
      now(),
      1
    )
    on conflict (user_id, action) do update
      set window_started_at = excluded.window_started_at,
          request_count = 1;
    return;
  end if;

  if current_count >= p_max_requests then
    raise exception 'RATE_LIMITED';
  end if;

  update public.security_rate_limits
  set request_count = request_count + 1
  where user_id = uid
    and action = p_action;
end;
$$;

revoke all on function public.enforce_action_rate_limit(text, integer, integer)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Report / host-application anti-spam.
-- ---------------------------------------------------------------------------

create or replace function public.submit_report(
  p_target_nick text,
  p_reason text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  report_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform public.enforce_action_rate_limit('report_submit', 3600, 5);

  if char_length(trim(coalesce(p_target_nick, ''))) < 1 then
    raise exception 'TARGET_REQUIRED';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'REASON_REQUIRED';
  end if;

  if char_length(trim(coalesce(p_details, ''))) < 5 then
    raise exception 'DETAILS_REQUIRED';
  end if;

  insert into public.reports (
    user_id,
    target_nick,
    reason,
    details,
    status
  )
  values (
    uid,
    left(trim(p_target_nick), 100),
    left(trim(p_reason), 100),
    left(trim(p_details), 4000),
    'open'
  )
  returning id into report_id;

  insert into public.activity_logs (
    user_id,
    event_type,
    path,
    details
  )
  values (
    uid,
    'report_submitted',
    '/reports',
    jsonb_build_object(
      'report_id', report_id,
      'target_nick', left(trim(p_target_nick), 100)
    )
  );

  return report_id;
end;
$$;

revoke execute on function public.submit_report(text, text, text) from public, anon;
grant execute on function public.submit_report(text, text, text) to authenticated;

create or replace function public.submit_host_application(
  p_vip boolean,
  p_reason text,
  p_discord text default null,
  p_telegram text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  nick text;
  app_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform public.enforce_action_rate_limit('host_application_submit', 86400, 2);

  select nickname
    into nick
  from public.profiles
  where id = uid;

  if nick is null then
    raise exception 'PROFILE_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_discord, '')), '') is null
     and nullif(trim(coalesce(p_telegram, '')), '') is null then
    raise exception 'CONTACT_REQUIRED';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'REASON_TOO_SHORT';
  end if;

  if exists (
    select 1
    from public.host_applications
    where user_id = uid
      and status in ('pending', 'approved')
  ) then
    raise exception 'ACTIVE_APPLICATION_EXISTS';
  end if;

  insert into public.host_applications (
    user_id,
    roblox_nick,
    has_vip,
    reason,
    discord_contact,
    telegram_contact,
    accepted_rules,
    status
  )
  values (
    uid,
    trim(nick),
    coalesce(p_vip, false),
    left(trim(p_reason), 2000),
    nullif(trim(coalesce(p_discord, '')), ''),
    nullif(trim(coalesce(p_telegram, '')), ''),
    true,
    'pending'
  )
  returning id into app_id;

  insert into public.activity_logs (
    user_id,
    event_type,
    path,
    details
  )
  values (
    uid,
    'host_application_submitted',
    '/host',
    jsonb_build_object('application_id', app_id)
  );

  return app_id;
end;
$$;

revoke execute on function public.submit_host_application(boolean, text, text, text)
from public, anon;
grant execute on function public.submit_host_application(boolean, text, text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Remove unnecessary direct DML from exposed tables.
-- All mutations below go through authenticated RPCs / triggers.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.host_applications from authenticated;
revoke insert, update, delete on public.reports from authenticated;
revoke insert, update, delete on public.match_lobbies from authenticated;
revoke insert, update, delete on public.match_lobby_members from authenticated;
revoke insert, update, delete on public.match_lobby_map_votes from authenticated;
revoke insert, update, delete on public.match_lobby_ready from authenticated;
revoke insert, update, delete on public.match_results from authenticated;
revoke insert, update, delete on public.match_result_players from authenticated;
revoke insert, update, delete on public.ban_requests from authenticated;
revoke insert, update, delete on public.custom_roles from authenticated;
revoke insert, update, delete on public.user_custom_roles from authenticated;
revoke insert, update, delete on public.activity_logs from authenticated;
revoke insert, update, delete on public.security_login_events from authenticated;

-- Host notifications have one legitimate direct client mutation:
-- the current host can mark their own notification read/dismissed.
grant select, update on public.host_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Matchmaking: serialize slot acquisition to eliminate 10/10 -> 11/10 races.
-- ---------------------------------------------------------------------------

create or replace function public.mm_search_lobby()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
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
  join public.match_lobbies l
    on l.id = lm.lobby_id
  where lm.user_id = uid
    and lm.member_kind = 'player'
    and l.status in ('waiting','searching','full','host_needed','ready')
  order by lm.joined_at desc
  limit 1;

  if lobby_id is not null then
    return lobby_id;
  end if;

  -- Lock the selected lobby row so two different players cannot claim
  -- the same final slot concurrently.
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
          join public.profiles p2
            on p2.id = m2.user_id
          where m2.lobby_id = l.id
            and m2.member_kind = 'player'
        ) - 500
      )
      and
      (
        select coalesce(avg(p3.elo), player_elo)
        from public.match_lobby_members m3
        join public.profiles p3
          on p3.id = m3.user_id
        where m3.lobby_id = l.id
          and m3.member_kind = 'player'
      ) + 500
  order by abs(
    player_elo - coalesce(
      (
        select avg(p4.elo)
        from public.match_lobby_members m4
        join public.profiles p4
          on p4.id = m4.user_id
        where m4.lobby_id = l.id
          and m4.member_kind = 'player'
      ),
      player_elo
    )
  ), l.created_at
  for update skip locked
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

  select count(*)
    into member_count
  from public.match_lobby_members m
  where m.lobby_id = lobby_id
    and m.member_kind = 'player';

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
        else 3
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
  else
    update public.match_lobbies
    set status = 'searching',
        last_activity_at = now()
    where id = lobby_id;
  end if;

  return lobby_id;
end;
$$;

revoke execute on function public.mm_search_lobby() from public, anon;
grant execute on function public.mm_search_lobby() to authenticated;

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
      'kind',
      (
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

  if is_staff and result_kind = 'player' and host_id is null then
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

revoke execute on function public.mm_join_lobby(uuid, boolean) from public, anon;
grant execute on function public.mm_join_lobby(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Matchmaking team assignment lock.
-- ---------------------------------------------------------------------------

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

revoke execute on function public.mm_assign_teams(uuid) from public, anon;
grant execute on function public.mm_assign_teams(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Strong result validation.
-- ---------------------------------------------------------------------------

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
  v_result_id uuid;
  lobby_host uuid;
  lobby_status text;
  lobby_player_count integer;
  participant_count integer := 0;
  seen_count integer := 0;
  item jsonb;
  player_id uuid;
  kills integer;
  deaths integer;
  won boolean;
  participated boolean;
  kd numeric;
  delta integer;
  base_delta integer;
  seen_ids uuid[] := '{}';
  has_teams boolean;
  distinct_outcomes integer;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select l.host_user_id, l.status
    into lobby_host, lobby_status
  from public.match_lobbies l
  where l.id = p_lobby_id
  for update;

  if lobby_host is null or lobby_host <> uid then
    raise exception 'HOST_ONLY';
  end if;

  if lobby_status <> 'in_game' then
    raise exception 'MATCH_NOT_IN_GAME';
  end if;

  if p_screenshot_path is null
     or char_length(trim(p_screenshot_path)) = 0 then
    raise exception 'SCREENSHOT_REQUIRED';
  end if;

  if p_screenshot_path not like
       uid::text || '/' || p_lobby_id::text || '-%' then
    raise exception 'INVALID_SCREENSHOT_PATH';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'match-screenshots'
      and o.name = p_screenshot_path
      and o.owner_id = uid::text
  ) then
    raise exception 'SCREENSHOT_NOT_OWNED';
  end if;

  if jsonb_typeof(p_players) <> 'array'
     or jsonb_array_length(p_players) < 2 then
    raise exception 'INVALID_RESULT';
  end if;

  if exists (
    select 1
    from public.match_results
    where lobby_id = p_lobby_id
  ) then
    raise exception 'RESULT_ALREADY_SUBMITTED';
  end if;

  select count(*)
    into lobby_player_count
  from public.match_lobby_members
  where lobby_id = p_lobby_id
    and member_kind = 'player';

  if lobby_player_count < 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;

  select exists (
    select 1
    from public.match_lobby_members
    where lobby_id = p_lobby_id
      and member_kind = 'player'
      and team is not null
  )
  into has_teams;

  insert into public.match_results (
    lobby_id,
    submitted_by,
    screenshot_path
  )
  values (
    p_lobby_id,
    uid,
    left(trim(p_screenshot_path), 500)
  )
  returning id into v_result_id;

  for item in
    select * from jsonb_array_elements(p_players)
  loop
    player_id := (item->>'user_id')::uuid;

    if player_id is null then
      raise exception 'INVALID_PLAYER';
    end if;

    if player_id = any(seen_ids) then
      raise exception 'DUPLICATE_PLAYER';
    end if;

    seen_ids := array_append(seen_ids, player_id);
    seen_count := seen_count + 1;

    if not exists (
      select 1
      from public.match_lobby_members
      where lobby_id = p_lobby_id
        and user_id = player_id
        and member_kind = 'player'
    ) then
      raise exception 'PLAYER_NOT_IN_LOBBY';
    end if;

    participated := coalesce((item->>'participated')::boolean, true);

    if not participated then
      continue;
    end if;

    participant_count := participant_count + 1;

    kills := greatest(
      0,
      least(999, coalesce((item->>'kills')::integer, 0))
    );

    deaths := greatest(
      0,
      least(999, coalesce((item->>'deaths')::integer, 0))
    );

    won := coalesce((item->>'won')::boolean, false);

    kd := round(
      kills::numeric / greatest(deaths, 1)::numeric,
      3
    );

    base_delta := case
      when won then 20
      else -20
    end;

    delta := greatest(
      -50,
      least(
        50,
        base_delta
          + round(
              greatest(-2, least(2, kd - 1)) * 10
            )::integer
      )
    );

    insert into public.match_result_players (
      result_id,
      user_id,
      kills,
      deaths,
      won,
      kd,
      elo_delta
    )
    values (
      v_result_id,
      player_id,
      kills,
      deaths,
      won,
      kd,
      delta
    );

    update public.profiles
    set elo = greatest(0, elo + delta),
        wins = wins + case when won then 1 else 0 end,
        losses = losses + case when won then 0 else 1 end
    where id = player_id;
  end loop;

  if seen_count <> lobby_player_count then
    raise exception 'RESULT_MISSING_PLAYERS';
  end if;

  if participant_count < 2 then
    raise exception 'NOT_ENOUGH_PLAYING_PLAYERS';
  end if;

  select count(distinct won)
    into distinct_outcomes
  from public.match_result_players
  where result_id = v_result_id;

  if distinct_outcomes <> 2 then
    raise exception 'INVALID_MATCH_OUTCOME';
  end if;

  if has_teams and exists (
    select 1
    from public.match_result_players rp
    join public.match_lobby_members m
      on m.lobby_id = p_lobby_id
     and m.user_id = rp.user_id
     and m.member_kind = 'player'
    group by m.team
    having count(*) filter (where rp.won) > 0
       and count(*) filter (where not rp.won) > 0
  ) then
    raise exception 'TEAM_RESULT_MISMATCH';
  end if;

  update public.match_lobbies
  set status = 'cancelled',
      last_activity_at = now()
  where id = p_lobby_id;

  begin
    insert into public.activity_logs (
      user_id,
      event_type,
      path,
      details
    )
    values (
      uid,
      'match_result_submitted',
      '/matchmaking',
      jsonb_build_object(
        'lobby_id', p_lobby_id,
        'result_id', v_result_id,
        'participants', participant_count
      )
    );
  exception
    when others then
      null;
  end;

  return v_result_id;

exception
  when others then
    if v_result_id is not null then
      delete from public.match_results
      where id = v_result_id;
    end if;
    raise;
end;
$$;

revoke execute on function public.submit_match_result(uuid, text, jsonb)
from public, anon;
grant execute on function public.submit_match_result(uuid, text, jsonb)
to authenticated;

-- ---------------------------------------------------------------------------
-- Match-result reads: only participants/host/staff should see results.
-- ---------------------------------------------------------------------------

drop policy if exists "Staff read match results" on public.match_results;

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

-- ---------------------------------------------------------------------------
-- Keep public leaderboard safe and explicit.
-- ---------------------------------------------------------------------------

revoke all on function public.public_leaderboard(integer) from public;
grant execute on function public.public_leaderboard(integer) to anon, authenticated;

notify pgrst, 'reload schema';