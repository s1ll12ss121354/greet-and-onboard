-- ReCorN: remove legacy permissive lobby RLS policies.
-- These policies were introduced by 20261008203000 as a recursion workaround
-- and later became too broad after scoped lobby-membership policies were added.
--
-- Keep only participant-scoped read access:
--   * match_lobbies: creator or current lobby member
--   * match_lobby_members: current user or current lobby member
--   * match_lobby_map_votes: current lobby member

drop policy if exists "Authenticated users can read active lobbies" on public.match_lobbies;
drop policy if exists "Authenticated users can read lobby members" on public.match_lobby_members;
drop policy if exists "Authenticated users can read map votes" on public.match_lobby_map_votes;

drop policy if exists "Lobby members can read their lobby" on public.match_lobbies;
drop policy if exists "Lobby members can read lobby roster" on public.match_lobby_members;
drop policy if exists "Lobby members can read map votes" on public.match_lobby_map_votes;

revoke select on public.match_lobbies from public, anon;
revoke select on public.match_lobby_members from public, anon;
revoke select on public.match_lobby_map_votes from public, anon;

grant select on public.match_lobbies to authenticated;
grant select on public.match_lobby_members to authenticated;
grant select on public.match_lobby_map_votes to authenticated;

create policy "Lobby members can read their lobby"
on public.match_lobbies
for select
to authenticated
using (
  status <> 'cancelled'
  and (
    creator_id = (select auth.uid())
    or public.is_recorn_lobby_member(id)
  )
);

create policy "Lobby members can read lobby roster"
on public.match_lobby_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_recorn_lobby_member(lobby_id)
);

create policy "Lobby members can read map votes"
on public.match_lobby_map_votes
for select
to authenticated
using (
  public.is_recorn_lobby_member(lobby_id)
);

notify pgrst, 'reload schema';
