-- ReCorN: repair legacy activity_logs schema and make owner force-start resilient.

-- The live database may already have an older activity_logs table.
-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
alter table public.activity_logs
  add column if not exists event_type text;

-- Keep the force-start action working even if a legacy audit table still
-- differs from the current audit schema.
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

  begin
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
  exception
    when others then
      -- Audit logging must not prevent the owner from starting a match.
      null;
  end;

  return true;
end;
$$;

revoke all on function public.mm_owner_start_lobby(uuid) from public, anon;
grant execute on function public.mm_owner_start_lobby(uuid) to authenticated;

notify pgrst, 'reload schema';
