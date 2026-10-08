-- ReCorN: force-start always resolves a host when the owner is in the lobby.
-- Priority:
-- 1) host in lobby
-- 2) moderator in lobby
-- 3) admin in lobby
-- 4) the owner who started the match, if the owner is a lobby player

create or replace function public.mm_owner_start_lobby(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_status text;
  lobby_host uuid;
begin
  if uid is null or not public.is_recorn_owner(uid) then
    raise exception 'OWNER_ONLY';
  end if;

  select l.status
    into current_status
  from public.match_lobbies l
  where l.id = p_lobby_id
  for update;

  if current_status is null then
    raise exception 'LOBBY_NOT_FOUND';
  end if;

  if current_status in ('cancelled', 'in_game') then
    raise exception 'LOBBY_NOT_STARTABLE';
  end if;

  -- First choose a privileged player who is already inside the lobby.
  select m.user_id
    into lobby_host
  from public.match_lobby_members m
  join public.user_roles r
    on r.user_id = m.user_id
  where m.lobby_id = p_lobby_id
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
      when 'admin'::public.app_role then 3
      else 4
    end,
    m.joined_at
  limit 1;

  -- If there is no privileged player in the lobby, use the owner
  -- who pressed "Force start", but only if the owner is actually in it.
  if lobby_host is null
     and exists (
       select 1
       from public.match_lobby_members m
       where m.lobby_id = p_lobby_id
         and m.user_id = uid
         and m.member_kind = 'player'
     )
  then
    lobby_host := uid;
  end if;

  if lobby_host is null then
    raise exception 'HOST_NOT_FOUND_IN_LOBBY';
  end if;

  update public.match_lobbies
  set
    status = 'in_game',
    host_user_id = lobby_host,
    selected_map = coalesce(selected_map, 'Mirage'),
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
      'owner_force_started_match',
      '/matchmaking',
      jsonb_build_object(
        'lobby_id', p_lobby_id,
        'previous_status', current_status,
        'host_user_id', lobby_host
      )
    );
  exception
    when others then
      null;
  end;

  return true;
end;
$$;

revoke all
on function public.mm_owner_start_lobby(uuid)
from public, anon;

grant execute
on function public.mm_owner_start_lobby(uuid)
to authenticated;

notify pgrst, 'reload schema';
