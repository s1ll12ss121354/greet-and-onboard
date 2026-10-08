-- ReCorN: restore the exact zero-argument mm_open_lobbies RPC.
-- PostgREST must see public.mm_open_lobbies() with no parameters.

drop function if exists public.mm_open_lobbies();

create function public.mm_open_lobbies()
returns table (
  id uuid,
  status text,
  creator_id uuid,
  player_count bigint,
  spectator_count bigint,
  search_started_at timestamptz,
  host_user_id uuid,
  selected_map text
)
language sql
security definer
set search_path = ''
as $$
  select
    l.id,
    l.status,
    l.creator_id,
    count(*) filter (where m.member_kind = 'player') as player_count,
    count(*) filter (where m.member_kind = 'spectator') as spectator_count,
    l.search_started_at,
    l.host_user_id,
    l.selected_map
  from public.match_lobbies l
  left join public.match_lobby_members m
    on m.lobby_id = l.id
  where l.status in (
    'waiting',
    'searching',
    'full',
    'host_needed',
    'ready'
  )
  group by
    l.id,
    l.status,
    l.creator_id,
    l.search_started_at,
    l.host_user_id,
    l.selected_map
  order by l.created_at desc
  limit 50;
$$;

revoke all
on function public.mm_open_lobbies()
from public, anon;

grant execute
on function public.mm_open_lobbies()
to authenticated;

notify pgrst, 'reload schema';
