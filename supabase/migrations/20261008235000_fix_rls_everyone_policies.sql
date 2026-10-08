-- ReCorN security hardening:
-- Replace permissive RLS policies that used USING (true).
-- Direct table reads are restricted; matchmaking RPCs remain the public
-- application interface for discovering/joining lobbies.

create or replace function public.is_recorn_lobby_member(
  p_lobby_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.match_lobby_members m
      where m.lobby_id = p_lobby_id
        and m.user_id = p_user_id
    );
$$;

revoke all on function public.is_recorn_lobby_member(uuid, uuid) from public, anon;
grant execute on function public.is_recorn_lobby_member(uuid, uuid) to authenticated;

-- 1. System roles: users can read their own roles; admins can read all roles.
drop policy if exists "Roles are public" on public.user_roles;
drop policy if exists "Users can read own roles" on public.user_roles;

create policy "Users can read own roles"
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

-- 2. Match lobbies: direct table reads are limited to the creator or
-- someone who is already a member. The open-lobbies RPC is still available
-- to authenticated users for discovery.
drop policy if exists "Authenticated users can read active lobbies" on public.match_lobbies;

create policy "Lobby members can read their lobby"
on public.match_lobbies
for select
to authenticated
using (
  status <> 'cancelled'
  and (
    creator_id = (select auth.uid())
    or public.is_recorn_lobby_member(id, (select auth.uid()))
  )
);

-- 3. Lobby members: only members of a lobby can see that lobby's roster.
drop policy if exists "Members can read lobby members" on public.match_lobby_members;
drop policy if exists "Authenticated users can read lobby members" on public.match_lobby_members;

create policy "Lobby members can read lobby roster"
on public.match_lobby_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_recorn_lobby_member(lobby_id, (select auth.uid()))
);

-- 4. Map votes: only members of the lobby can see its votes.
drop policy if exists "Lobby members can read map votes" on public.match_lobby_map_votes;
drop policy if exists "Authenticated users can read map votes" on public.match_lobby_map_votes;

create policy "Lobby members can read map votes"
on public.match_lobby_map_votes
for select
to authenticated
using (
  public.is_recorn_lobby_member(lobby_id, (select auth.uid()))
);

-- 5. Custom roles are admin configuration, not public data.
drop policy if exists "Authenticated read custom roles" on public.custom_roles;

create policy "Admins read custom roles"
on public.custom_roles
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
);

-- 6. User-to-custom-role assignments are visible to the assigned user
-- and to admins only.
drop policy if exists "Authenticated read user custom roles" on public.user_custom_roles;

create policy "Users and admins read custom role assignments"
on public.user_custom_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

notify pgrst, 'reload schema';