-- ReCorN security hardening: temporary bans, matchmaking abuse protection and audit-safe moderation.
alter table public.profiles
  add column if not exists ban_until timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_ban_until_idx on public.profiles(ban_until);

create or replace function public.is_active_ban(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and banned = true
      and (ban_until is null or ban_until > now())
  );
$$;

revoke execute on function public.is_active_ban(uuid) from public, anon;
grant execute on function public.is_active_ban(uuid) to authenticated;

-- Enforce bans even inside SECURITY DEFINER matchmaking functions.
create or replace function public.block_banned_match_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_active_ban(new.user_id) then
    raise exception 'PLAYER_BANNED';
  end if;
  return new;
end;
$$;

drop trigger if exists block_banned_match_member on public.match_lobby_members;
create trigger block_banned_match_member
before insert on public.match_lobby_members
for each row execute function public.block_banned_match_member();

create or replace function public.block_banned_lobby_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_active_ban(new.creator_id) then
    raise exception 'PLAYER_BANNED';
  end if;
  return new;
end;
$$;

drop trigger if exists block_banned_lobby_creator on public.match_lobbies;
create trigger block_banned_lobby_creator
before insert on public.match_lobbies
for each row execute function public.block_banned_lobby_creator();

-- Simple server-side anti-abuse bucket for matchmaking mutations.
create table if not exists public.security_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (user_id, action)
);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from anon, authenticated;

create or replace function public.enforce_match_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_count integer;
  started timestamptz;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select request_count, window_started_at
    into current_count, started
  from public.security_rate_limits
  where user_id = uid and action = 'match_join';

  if started is null or started <= now() - interval '1 minute' then
    insert into public.security_rate_limits(user_id, action, window_started_at, request_count)
    values(uid, 'match_join', now(), 1)
    on conflict (user_id, action) do update
      set window_started_at = excluded.window_started_at, request_count = 1;
  elsif current_count >= 12 then
    raise exception 'RATE_LIMITED';
  else
    update public.security_rate_limits
    set request_count = request_count + 1
    where user_id = uid and action = 'match_join';
  end if;

  return new;
end;
$$;

drop trigger if exists match_member_rate_limit on public.match_lobby_members;
create trigger match_member_rate_limit
before insert on public.match_lobby_members
for each row execute function public.enforce_match_rate_limit();

-- Replace the old permanent-ban-only report RPC with duration + mandatory reason.
drop function if exists public.admin_set_report_status(uuid,text);

create or replace function public.admin_set_report_status(
  p_report_id uuid,
  p_status text,
  p_ban_minutes integer default null,
  p_ban_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target text;
  target_id uuid;
  until_at timestamptz;
  clean_reason text := nullif(trim(p_ban_reason), '');
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_status not in ('resolved','rejected') then
    raise exception 'INVALID_REPORT_STATUS';
  end if;

  select r.target_nick into target
  from public.reports r
  where r.id = p_report_id and r.status = 'open'
  for update;

  if target is null then raise exception 'REPORT_NOT_OPEN'; end if;

  if p_status = 'resolved' then
    if clean_reason is null then raise exception 'BAN_REASON_REQUIRED'; end if;
    if p_ban_minutes is not null and p_ban_minutes <= 0 then raise exception 'INVALID_BAN_DURATION'; end if;

    select p.id into target_id
    from public.profiles p
    where lower(trim(p.nickname)) = lower(trim(target))
    limit 1;

    if target_id is null then raise exception 'TARGET_PROFILE_NOT_FOUND'; end if;

    until_at := case
      when p_ban_minutes is null then null
      else now() + make_interval(mins => p_ban_minutes)
    end;

    update public.profiles
    set banned = true,
        ban_until = until_at,
        ban_reason = clean_reason
    where id = target_id;

    update public.reports set status = 'resolved' where id = p_report_id;

    insert into public.activity_logs(user_id,event_type,path,details)
    values(uid,'report_approved','/admin',
      jsonb_build_object(
        'report_id',p_report_id,
        'target_nick',target,
        'target_user_id',target_id,
        'ban_minutes',p_ban_minutes,
        'ban_until',until_at,
        'ban_reason',clean_reason
      ));
  else
    update public.reports set status = 'rejected' where id = p_report_id;
    insert into public.activity_logs(user_id,event_type,path,details)
    values(uid,'report_rejected','/admin',
      jsonb_build_object('report_id',p_report_id,'target_nick',target));
  end if;

  return true;
end;
$$;

revoke execute on function public.admin_set_report_status(uuid,text,integer,text) from public, anon;
grant execute on function public.admin_set_report_status(uuid,text,integer,text) to authenticated;
