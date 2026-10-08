-- Restore matchmaking RPCs used by src/routes/matchmaking.tsx.
-- This migration is intentionally defensive: it creates the RPCs with the
-- current match_lobbies schema and grants authenticated users access.

create or replace function public.mm_search_lobby()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select ml.id
    into v_lobby
  from public.match_lobbies ml
  join public.match_lobby_members mm on mm.lobby_id = ml.id
  where mm.user_id = auth.uid()
    and mm.member_kind = 'player'
    and ml.status in ('searching','waiting','ready','host_needed')
  order by ml.search_started_at desc
  limit 1;

  if v_lobby is not null then
    return v_lobby;
  end if;

  insert into public.match_lobbies (creator_id, status, search_started_at)
  values (auth.uid(), 'searching', now())
  returning id into v_lobby;

  insert into public.match_lobby_members (lobby_id, user_id, member_kind)
  values (v_lobby, auth.uid(), 'player');

  return v_lobby;
exception
  when undefined_table then
    raise exception 'MATCHMAKING_TABLES_MISSING';
end;
$$;

grant execute on function public.mm_search_lobby() to authenticated;

create or replace function public.mm_create_lobby()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select id into v_lobby
  from public.match_lobbies
  where creator_id = auth.uid()
    and status in ('searching','waiting','ready','host_needed')
  order by created_at desc
  limit 1;

  if v_lobby is not null then return v_lobby; end if;

  insert into public.match_lobbies (creator_id, status, search_started_at)
  values (auth.uid(), 'waiting', now())
  returning id into v_lobby;

  insert into public.match_lobby_members (lobby_id, user_id, member_kind)
  values (v_lobby, auth.uid(), 'player');

  return v_lobby;
end;
$$;

grant execute on function public.mm_create_lobby() to authenticated;

create or replace function public.mm_open_lobbies()
returns setof public.match_lobbies
language sql
security definer
set search_path = public
as $$
  select ml.*
  from public.match_lobbies ml
  where ml.status in ('searching','waiting','ready','host_needed')
  order by ml.created_at desc
  limit 50
$$;

grant execute on function public.mm_open_lobbies() to authenticated;
