-- ReCorN: owner permissions for isy_hesy09.
-- The owner may access the full admin panel, grant admin, and force-start
-- their own matchmaking lobby before the normal player count is reached.

create or replace function public.is_recorn_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and lower(trim(p.nickname)) = 'isy_hesy09'
  );
$$;

revoke all on function public.is_recorn_owner(uuid) from public, anon;
grant execute on function public.is_recorn_owner(uuid) to authenticated;

-- Ensure the creator has admin access even if the role row did not exist yet.
insert into public.user_roles(user_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
where lower(trim(p.nickname)) = 'isy_hesy09'
on conflict (user_id, role) do nothing;

-- Protect the admin role from arbitrary direct table writes.
create or replace function public.protect_admin_role_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  changing_admin boolean := false;
begin
  if tg_op = 'DELETE' then
    changing_admin := old.role = 'admin'::public.app_role;
  else
    changing_admin := new.role = 'admin'::public.app_role
      or (tg_op = 'UPDATE' and old.role = 'admin'::public.app_role);
  end if;

  if changing_admin and not public.is_recorn_owner(uid) then
    raise exception 'OWNER_ONLY_ADMIN_ROLE';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_admin_role_changes on public.user_roles;
create trigger protect_admin_role_changes
before insert or update or delete on public.user_roles
for each row
execute function public.protect_admin_role_changes();

-- Owner-only RPC for granting admin. Never accept a nickname from the client:
-- the caller identity is taken from auth.uid().
create or replace function public.owner_grant_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_recorn_owner(uid) then
    raise exception 'OWNER_ONLY';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  insert into public.user_roles(user_id, role)
  values (p_user_id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  insert into public.activity_logs(user_id, event_type, path, details)
  values (
    uid,
    'admin_role_granted',
    '/admin',
    jsonb_build_object('target_user_id', p_user_id)
  );

  return true;
end;
$$;

revoke all on function public.owner_grant_admin(uuid) from public, anon;
grant execute on function public.owner_grant_admin(uuid) to authenticated;

-- Owner can force-start only a lobby they created. This bypasses the normal
-- 10-player ready flow and is intentionally restricted to the owner account.
create or replace function public.mm_owner_start_lobby(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lobby_creator uuid;
  current_status text;
begin
  if uid is null or not public.is_recorn_owner(uid) then
    raise exception 'OWNER_ONLY';
  end if;

  select creator_id, status
  into lobby_creator, current_status
  from public.match_lobbies
  where id = p_lobby_id
  for update;

  if lobby_creator is null then
    raise exception 'LOBBY_NOT_FOUND';
  end if;

  if lobby_creator <> uid then
    raise exception 'LOBBY_OWNER_ONLY';
  end if;

  if current_status in ('cancelled','in_game') then
    raise exception 'LOBBY_NOT_STARTABLE';
  end if;

  update public.match_lobbies
  set status = 'in_game',
      host_user_id = uid,
      selected_map = coalesce(selected_map, 'Mirage'),
      last_activity_at = now()
  where id = p_lobby_id;

  insert into public.activity_logs(user_id, event_type, path, details)
  values (
    uid,
    'owner_force_started_match',
    '/matchmaking',
    jsonb_build_object('lobby_id', p_lobby_id)
  );

  return true;
end;
$$;

revoke all on function public.mm_owner_start_lobby(uuid) from public, anon;
grant execute on function public.mm_owner_start_lobby(uuid) to authenticated;

notify pgrst, 'reload schema';
