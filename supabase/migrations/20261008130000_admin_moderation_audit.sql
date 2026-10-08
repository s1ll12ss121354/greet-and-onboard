-- Admin audit logs, moderator ban approvals, and custom roles.
-- Security model: users may record only their own activity through a constrained RPC;
-- only admins can read audit logs or mutate custom roles / approve bans.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 64),
  path text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_idx
  on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_created_idx
  on public.activity_logs(user_id, created_at desc);

create table if not exists public.ban_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  target_nick text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists ban_requests_report_pending_idx
  on public.ban_requests(report_id)
  where status = 'pending';

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#7c3aed',
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (lower(trim(name)))
);

create table if not exists public.user_custom_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.custom_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

alter table public.activity_logs enable row level security;
alter table public.ban_requests enable row level security;
alter table public.custom_roles enable row level security;
alter table public.user_custom_roles enable row level security;

revoke all on table public.activity_logs from anon, authenticated;
revoke all on table public.ban_requests from anon, authenticated;
revoke all on table public.custom_roles from anon, authenticated;
revoke all on table public.user_custom_roles from anon, authenticated;

grant select on public.activity_logs to authenticated;
grant select on public.ban_requests to authenticated;
grant select on public.custom_roles to authenticated;
grant select on public.user_custom_roles to authenticated;

drop policy if exists "Admins read activity logs" on public.activity_logs;
create policy "Admins read activity logs"
on public.activity_logs for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "Staff read ban requests" on public.ban_requests;
create policy "Staff read ban requests"
on public.ban_requests for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or public.has_role((select auth.uid()), 'moderator')
);

drop policy if exists "Authenticated read custom roles" on public.custom_roles;
create policy "Authenticated read custom roles"
on public.custom_roles for select to authenticated
using (true);

drop policy if exists "Authenticated read user custom roles" on public.user_custom_roles;
create policy "Authenticated read user custom roles"
on public.user_custom_roles for select to authenticated
using (true);

-- Moderators may see reports, but a moderator cannot directly alter report content
-- or a player's banned flag. Only an admin can approve a ban request.
drop policy if exists "Own or staff read" on public.reports;
create policy "Own or staff read"
on public.reports for select to authenticated
using (
  (select auth.uid()) = user_id
  or public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
);

drop policy if exists "Staff update" on public.reports;
create policy "Staff update"
on public.reports for update to authenticated
using (
  public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
)
with check (
  public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
);

create or replace function public.protect_report_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_role((select auth.uid()), 'admin') then
    return new;
  end if;

  if public.has_role((select auth.uid()), 'moderator') then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.target_nick is distinct from old.target_nick
       or new.reason is distinct from old.reason
       or new.details is distinct from old.details
       or new.priority is distinct from old.priority
       or new.created_at is distinct from old.created_at then
      raise exception 'MODERATOR_REPORT_FIELDS_PROTECTED';
    end if;
    return new;
  end if;

  raise exception 'STAFF_ONLY';
end;
$$;

drop trigger if exists protect_report_updates on public.reports;
create trigger protect_report_updates
before update on public.reports
for each row execute function public.protect_report_updates();

create or replace function public.log_activity(
  p_event_type text,
  p_path text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  event_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_event_type is null
     or char_length(trim(p_event_type)) = 0
     or char_length(p_event_type) > 64 then
    raise exception 'INVALID_EVENT_TYPE';
  end if;

  insert into public.activity_logs(user_id, event_type, path, details)
  values (
    uid,
    trim(p_event_type),
    nullif(left(coalesce(p_path, ''), 200), ''),
    case when jsonb_typeof(coalesce(p_details, '{}'::jsonb)) = 'object'
         then coalesce(p_details, '{}'::jsonb)
         else '{}'::jsonb end
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke execute on function public.log_activity(text,text,jsonb) from public, anon;
grant execute on function public.log_activity(text,text,jsonb) to authenticated;

create or replace function public.request_report_ban(p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target text;
  request_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_role(uid, 'moderator')
     and not public.has_role(uid, 'admin') then
    raise exception 'STAFF_ONLY';
  end if;

  select r.target_nick into target
  from public.reports r
  where r.id = p_report_id and r.status = 'open';

  if target is null then
    raise exception 'REPORT_NOT_OPEN';
  end if;

  select br.id into request_id
  from public.ban_requests br
  where br.report_id = p_report_id and br.status = 'pending'
  limit 1;

  if request_id is not null then
    return request_id;
  end if;

  insert into public.ban_requests(report_id, target_nick, requested_by)
  values (p_report_id, target, uid)
  returning id into request_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values (
    uid,
    'ban_request_created',
    '/admin',
    jsonb_build_object('report_id', p_report_id, 'target_nick', target)
  );

  return request_id;
end;
$$;

revoke execute on function public.request_report_ban(uuid) from public, anon;
grant execute on function public.request_report_ban(uuid) to authenticated;

create or replace function public.review_ban_request(
  p_request_id uuid,
  p_approve boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target text;
  report_id uuid;
  request_status text;
  target_id uuid;
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  select br.target_nick, br.report_id, br.status
    into target, report_id, request_status
  from public.ban_requests br
  where br.id = p_request_id
  for update;

  if target is null then raise exception 'BAN_REQUEST_NOT_FOUND'; end if;
  if request_status <> 'pending' then return true; end if;

  if p_approve then
    select p.id into target_id
    from public.profiles p
    where lower(trim(p.nickname)) = lower(trim(target))
    limit 1;

    if target_id is null then
      raise exception 'TARGET_PROFILE_NOT_FOUND';
    end if;

    update public.profiles
    set banned = true
    where id = target_id;

    update public.reports
    set status = 'resolved'
    where id = report_id;
  else
    update public.reports
    set status = 'rejected'
    where id = report_id;
  end if;

  update public.ban_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = uid,
      reviewed_at = now()
  where id = p_request_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values (
    uid,
    case when p_approve then 'ban_request_approved' else 'ban_request_rejected' end,
    '/admin',
    jsonb_build_object('ban_request_id', p_request_id, 'report_id', report_id, 'target_nick', target)
  );

  return true;
end;
$$;

revoke execute on function public.review_ban_request(uuid,boolean) from public, anon;
grant execute on function public.review_ban_request(uuid,boolean) to authenticated;

create or replace function public.admin_create_custom_role(
  p_name text,
  p_color text default '#7c3aed',
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  role_id uuid;
  clean_name text := trim(coalesce(p_name, ''));
  clean_color text := trim(coalesce(p_color, '#7c3aed'));
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;
  if clean_name !~ '^[^[:cntrl:]]{2,40}$' then
    raise exception 'INVALID_ROLE_NAME';
  end if;
  if clean_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_ROLE_COLOR';
  end if;

  insert into public.custom_roles(name,color,description,created_by)
  values(clean_name,clean_color,left(coalesce(p_description,''),160),uid)
  returning id into role_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'custom_role_created','/admin',jsonb_build_object('role_id',role_id,'name',clean_name));

  return role_id;
end;
$$;

revoke execute on function public.admin_create_custom_role(text,text,text) from public, anon;
grant execute on function public.admin_create_custom_role(text,text,text) to authenticated;

create or replace function public.admin_assign_custom_role(
  p_user_id uuid,
  p_role_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  if not exists(select 1 from public.custom_roles where id = p_role_id) then
    raise exception 'CUSTOM_ROLE_NOT_FOUND';
  end if;
  if not exists(select 1 from public.profiles where id = p_user_id) then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  insert into public.user_custom_roles(user_id,role_id)
  values(p_user_id,p_role_id)
  on conflict(user_id,role_id) do nothing;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'custom_role_assigned','/admin',jsonb_build_object('target_user_id',p_user_id,'role_id',p_role_id));

  return true;
end;
$$;

revoke execute on function public.admin_assign_custom_role(uuid,uuid) from public, anon;
grant execute on function public.admin_assign_custom_role(uuid,uuid) to authenticated;

create or replace function public.admin_remove_custom_role(
  p_user_id uuid,
  p_role_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  delete from public.user_custom_roles
  where user_id = p_user_id and role_id = p_role_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'custom_role_removed','/admin',jsonb_build_object('target_user_id',p_user_id,'role_id',p_role_id));

  return true;
end;
$$;

revoke execute on function public.admin_remove_custom_role(uuid,uuid) from public, anon;
grant execute on function public.admin_remove_custom_role(uuid,uuid) to authenticated;

create or replace function public.admin_delete_custom_role(p_role_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  delete from public.custom_roles where id = p_role_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'custom_role_deleted','/admin',jsonb_build_object('role_id',p_role_id));

  return true;
end;
$$;

revoke execute on function public.admin_delete_custom_role(uuid) from public, anon;
grant execute on function public.admin_delete_custom_role(uuid) to authenticated;

-- Fix the earlier trigger's has_role argument order.
create or replace function public.protect_profile_competitive_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.elo is distinct from old.elo
      or new.wins is distinct from old.wins
      or new.losses is distinct from old.losses
      or new.banned is distinct from old.banned)
     and not public.has_role((select auth.uid()), 'admin') then
    raise exception 'COMPETITIVE_FIELDS_PROTECTED';
  end if;
  return new;
end;
$$;

-- Prevent moderators from using the broad profiles UPDATE grant to change anything;
-- the existing profile trigger already blocks competitive fields, and this trigger
-- closes nickname changes by non-admin users too.
create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_role((select auth.uid()), 'admin') then
    return new;
  end if;

  if (select auth.uid()) is distinct from old.id then
    raise exception 'PROFILE_UPDATE_FORBIDDEN';
  end if;

  if new.nickname is distinct from old.nickname then
    raise exception 'NICKNAME_CHANGE_FORBIDDEN';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_self_update on public.profiles;
create trigger protect_profile_self_update
before update on public.profiles
for each row execute function public.protect_profile_self_update();
