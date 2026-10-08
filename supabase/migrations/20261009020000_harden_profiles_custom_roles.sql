-- ReCorN: harden profiles, custom_roles and user_custom_roles.
-- Public lobby profile data is exposed only through a narrow RPC.
-- Direct profile reads remain available only to the current user and admins.

-- ============================================================================
-- PROFILES
-- ============================================================================

alter table public.profiles enable row level security;

revoke select, insert, delete on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users admins and lobby members can read profiles" on public.profiles;

create policy "Users and admins read profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

drop policy if exists "Admins update profiles" on public.profiles;

create policy "Admins update profiles"
on public.profiles
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create or replace function public.protect_profile_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if current_setting('recorn.match_result', true) = '1'
     or current_setting('recorn.presence', true) = '1'
     or current_setting('recorn.profile_internal', true) = '1' then
    return new;
  end if;

  if uid is not null
     and public.has_role(uid, 'admin') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.nickname is distinct from old.nickname
     or new.created_at is distinct from old.created_at
     or new.elo is distinct from old.elo
     or new.wins is distinct from old.wins
     or new.losses is distinct from old.losses
     or new.banned is distinct from old.banned
     or new.ban_until is distinct from old.ban_until
     or new.ban_reason is distinct from old.ban_reason
     or new.support_priority is distinct from old.support_priority
     or new.last_seen_at is distinct from old.last_seen_at then
    raise exception 'PROFILE_FIELDS_PROTECTED';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_self_update on public.profiles;
drop trigger if exists protect_profile_competitive_fields on public.profiles;
drop trigger if exists protect_profile_mutations on public.profiles;

create trigger protect_profile_mutations
before update on public.profiles
for each row
execute function public.protect_profile_mutations();

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

  perform set_config('recorn.presence', '1', true);

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

-- Safe lobby profile endpoint. It never returns banned/support_priority/ban fields.
create or replace function public.lobby_public_profiles(p_lobby_id uuid)
returns table (
  id uuid,
  nickname text,
  elo integer,
  wins integer,
  losses integer,
  avatar_url text,
  banner_url text
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
    p.losses,
    p.avatar_url,
    p.banner_url
  from public.profiles p
  join public.match_lobby_members lm
    on lm.user_id = p.id
   and lm.lobby_id = p_lobby_id
  where exists (
    select 1
    from public.match_lobby_members mine
    where mine.lobby_id = p_lobby_id
      and mine.user_id = (select auth.uid())
  )
  order by lm.joined_at, p.nickname;
$$;

revoke all on function public.lobby_public_profiles(uuid) from public, anon;
grant execute on function public.lobby_public_profiles(uuid) to authenticated;

-- ============================================================================
-- CUSTOM ROLES
-- ============================================================================

alter table public.custom_roles enable row level security;
alter table public.user_custom_roles enable row level security;

revoke all on public.custom_roles from public, anon, authenticated;
revoke all on public.user_custom_roles from public, anon, authenticated;

grant select on public.custom_roles to authenticated;
grant select on public.user_custom_roles to authenticated;

drop policy if exists "Authenticated read custom roles" on public.custom_roles;
drop policy if exists "Admins read custom roles" on public.custom_roles;

create policy "Admins read custom roles"
on public.custom_roles
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
);

drop policy if exists "Authenticated read user custom roles" on public.user_custom_roles;
drop policy if exists "Users and admins read custom role assignments" on public.user_custom_roles;

create policy "Users and admins read custom role assignments"
on public.user_custom_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

create or replace function public.protect_custom_role_writes()
returns trigger
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

  if tg_op = 'INSERT' then
    if new.created_by <> uid then
      raise exception 'ROLE_CREATOR_MISMATCH';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.created_by is distinct from old.created_by then
      raise exception 'ROLE_ID_PROTECTED';
    end if;
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

drop trigger if exists protect_custom_role_writes on public.custom_roles;

create trigger protect_custom_role_writes
before insert or update or delete on public.custom_roles
for each row
execute function public.protect_custom_role_writes();

create or replace function public.protect_user_custom_role_writes()
returns trigger
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

  if tg_op = 'INSERT' then
    if new.user_id is null or new.role_id is null then
      raise exception 'INVALID_CUSTOM_ROLE_ASSIGNMENT';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.role_id is distinct from old.role_id then
      raise exception 'CUSTOM_ROLE_ASSIGNMENT_ID_PROTECTED';
    end if;
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

drop trigger if exists protect_user_custom_role_writes on public.user_custom_roles;

create trigger protect_user_custom_role_writes
before insert or update or delete on public.user_custom_roles
for each row
execute function public.protect_user_custom_role_writes();

-- Recreate admin custom-role RPCs so this migration is self-contained.

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

  if char_length(clean_name) < 2 or char_length(clean_name) > 40
     or clean_name ~ E'[[:cntrl:]]' then
    raise exception 'INVALID_ROLE_NAME';
  end if;

  if char_length(clean_color) <> 7
     or clean_color !~ '^#[0-9A-Fa-f]{6}' then
    raise exception 'INVALID_ROLE_COLOR';
  end if;

  insert into public.custom_roles(name, color, description, created_by)
  values (
    clean_name,
    clean_color,
    left(coalesce(p_description, ''), 160),
    uid
  )
  returning id into role_id;

  begin
    insert into public.activity_logs(
      user_id,
      event_type,
      path,
      details
    )
    values (
      uid,
      'custom_role_created',
      '/admin',
      jsonb_build_object(
        'role_id', role_id,
        'name', clean_name
      )
    );
  exception
    when others then
      null;
  end;

  return role_id;
end;
$$;

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

  if not exists (
    select 1 from public.custom_roles where id = p_role_id
  ) then
    raise exception 'CUSTOM_ROLE_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  insert into public.user_custom_roles(user_id, role_id)
  values (p_user_id, p_role_id)
  on conflict (user_id, role_id) do nothing;

  return true;
end;
$$;

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
  where user_id = p_user_id
    and role_id = p_role_id;

  return true;
end;
$$;

create or replace function public.admin_delete_custom_role(
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

  delete from public.custom_roles
  where id = p_role_id;

  return true;
end;
$$;

revoke execute on function public.admin_create_custom_role(text,text,text) from public, anon;
revoke execute on function public.admin_assign_custom_role(uuid,uuid) from public, anon;
revoke execute on function public.admin_remove_custom_role(uuid,uuid) from public, anon;
revoke execute on function public.admin_delete_custom_role(uuid) from public, anon;

grant execute on function public.admin_create_custom_role(text,text,text) to authenticated;
grant execute on function public.admin_assign_custom_role(uuid,uuid) to authenticated;
grant execute on function public.admin_remove_custom_role(uuid,uuid) to authenticated;
grant execute on function public.admin_delete_custom_role(uuid) to authenticated;

notify pgrst, 'reload schema';
