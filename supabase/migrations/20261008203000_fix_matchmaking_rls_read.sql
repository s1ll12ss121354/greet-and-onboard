-- ReCorN: fix recursive matchmaking RLS policies.
-- The previous match_lobby_members SELECT policy referenced the same table,
-- which can cause recursive policy evaluation and make the UI appear to do nothing.

drop policy if exists "Members can read lobby members" on public.match_lobby_members;
create policy "Authenticated users can read lobby members"
on public.match_lobby_members
for select
to authenticated
using (true);

drop policy if exists "Lobby members can read map votes" on public.match_lobby_map_votes;
create policy "Authenticated users can read map votes"
on public.match_lobby_map_votes
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read active lobbies" on public.match_lobbies;
create policy "Authenticated users can read active lobbies"
on public.match_lobbies
for select
to authenticated
using (status <> 'cancelled');

grant select on public.match_lobbies to authenticated;
grant select on public.match_lobby_members to authenticated;
grant select on public.match_lobby_map_votes to authenticated;

notify pgrst, 'reload schema';
