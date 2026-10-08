-- ReCorN: the project owner can force-start ANY lobby.
-- The previous version incorrectly limited the owner to lobbies they created.

create or replace function public.mm_owner_start_lobby(p_lobby_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_status text;
begin
  if uid is null or not public.is_recorn_owner(uid) then
    raise exception 'OWNER_ONLY';
  end if;

  select status
  into current_status
  from public.match_lobbies
  where id = p_lobby_id
  for update;

  if current_status is null then
    raise exception 'LOBBY_NOT_FOUND';
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
    jsonb_build_object(
      'lobby_id', p_lobby_id,
      'previous_status', current_status
    )
  );

  return true;
end;
$$;

revoke all on function public.mm_owner_start_lobby(uuid) from public, anon;
grant execute on function public.mm_owner_start_lobby(uuid) to authenticated;

notify pgrst, 'reload schema';
