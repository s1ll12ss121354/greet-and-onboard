-- ReCorN security remediation (2026-10-09)
-- Removes residual permissive policies seen on the live database and prevents a
-- removed player from rejoining the same lobby through any RPC/table insert.
-- Idempotent; does not delete existing application data.

-- ---------------------------------------------------------------------------
-- 1) Remove residual "allow everybody" reads on sensitive tables.
-- These old policy names were present alongside the newer restrictive policies,
-- and PostgreSQL combines permissive policies with OR.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
revoke select on public.profiles from anon;

drop policy if exists "Public profiles are readable" on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists "Users and admins read profiles" on public.profiles;
drop policy if exists "Read own profiles or staff" on public.profiles;

create policy "Users and admins read profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.is_recorn_owner((select auth.uid()))
);

alter table public.custom_roles enable row level security;
revoke all on public.custom_roles from anon;
grant select on public.custom_roles to authenticated;

drop policy if exists custom_roles_read on public.custom_roles;
drop policy if exists "Admins read custom roles" on public.custom_roles;
drop policy if exists "Staff read custom roles" on public.custom_roles;

create policy "Admins read custom roles"
on public.custom_roles for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.is_recorn_owner((select auth.uid()))
);

alter table public.user_custom_roles enable row level security;
revoke all on public.user_custom_roles from anon;
grant select on public.user_custom_roles to authenticated;

drop policy if exists user_custom_roles_read on public.user_custom_roles;
drop policy if exists "Users and admins read custom role assignments" on public.user_custom_roles;
drop policy if exists "Read own custom role assignments or staff" on public.user_custom_roles;

create policy "Users and admins read custom role assignments"
on public.user_custom_roles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.is_recorn_owner((select auth.uid()))
);

-- The public leaderboard and lobby roster already use narrow SECURITY DEFINER
-- RPCs, so public ranking and the visible lobby roster do not require broad
-- direct SELECT access to profiles.

-- ---------------------------------------------------------------------------
-- 2) Keep a private record of players removed by staff/hosts from a lobby.
-- ---------------------------------------------------------------------------

create table if not exists public.match_lobby_kicks (
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kicked_by uuid not null references auth.users(id) on delete restrict,
  kicked_at timestamptz not null default now(),
  reason text,
  primary key (lobby_id, user_id)
);

alter table public.match_lobby_kicks enable row level security;
revoke all on public.match_lobby_kicks from public, anon, authenticated;

create or replace function public.prevent_kicked_lobby_rejoin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.match_lobby_kicks k
    where k.lobby_id = new.lobby_id
      and k.user_id = new.user_id
  ) then
    raise exception 'PLAYER_KICKED_FROM_LOBBY';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_kicked_lobby_rejoin() from public, anon, authenticated;
drop trigger if exists prevent_kicked_lobby_rejoin on public.match_lobby_members;
create trigger prevent_kicked_lobby_rejoin
before insert on public.match_lobby_members
for each row execute function public.prevent_kicked_lobby_rejoin();

-- Any existing server-side removal by an authorized host/moderator/admin is
-- recorded as a kick. A player's own voluntary leave is deliberately excluded.
create or replace function public.record_staff_lobby_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  authorized boolean := false;
begin
  if actor is null or actor = old.user_id then
    return old;
  end if;

  select
    public.is_recorn_owner(actor)
    or public.has_role(actor, 'admin'::public.app_role)
    or public.has_role(actor, 'moderator'::public.app_role)
    or exists (
      select 1
      from public.match_lobbies l
      where l.id = old.lobby_id and l.host_user_id = actor
    )
  into authorized;

  if authorized then
    insert into public.match_lobby_kicks(lobby_id, user_id, kicked_by)
    values (old.lobby_id, old.user_id, actor)
    on conflict (lobby_id, user_id) do nothing;
  end if;

  return old;
end;
$$;

revoke all on function public.record_staff_lobby_removal() from public, anon, authenticated;
drop trigger if exists record_staff_lobby_removal on public.match_lobby_members;
create trigger record_staff_lobby_removal
after delete on public.match_lobby_members
for each row execute function public.record_staff_lobby_removal();

-- Explicit server-side kick action for future/current moderation UI.
create or replace function public.mm_kick_lobby_member(
  p_lobby_id uuid,
  p_user_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  allowed boolean := false;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_user_id is null or p_user_id = actor then
    raise exception 'INVALID_KICK_TARGET';
  end if;

  select
    public.is_recorn_owner(actor)
    or public.has_role(actor, 'admin'::public.app_role)
    or public.has_role(actor, 'moderator'::public.app_role)
    or exists (
      select 1
      from public.match_lobbies l
      where l.id = p_lobby_id and l.host_user_id = actor
    )
  into allowed;

  if not allowed then
    raise exception 'LOBBY_MODERATION_ONLY';
  end if;

  if public.is_recorn_owner(p_user_id) then
    raise exception 'CANNOT_KICK_OWNER';
  end if;
  if public.has_role(p_user_id, 'admin'::public.app_role)
     and not public.is_recorn_owner(actor) then
    raise exception 'OWNER_ONLY_ADMIN_KICK';
  end if;

  if not exists (
    select 1 from public.match_lobby_members
    where lobby_id = p_lobby_id and user_id = p_user_id
  ) then
    raise exception 'PLAYER_NOT_IN_LOBBY';
  end if;

  insert into public.match_lobby_kicks(lobby_id, user_id, kicked_by, reason)
  values (p_lobby_id, p_user_id, actor, left(coalesce(p_reason, ''), 240))
  on conflict (lobby_id, user_id)
  do update set kicked_by = excluded.kicked_by,
                kicked_at = now(),
                reason = excluded.reason;

  delete from public.match_lobby_map_votes
  where lobby_id = p_lobby_id and user_id = p_user_id;

  delete from public.match_lobby_members
  where lobby_id = p_lobby_id and user_id = p_user_id;

  update public.match_lobbies
  set host_user_id = case when host_user_id = p_user_id then null else host_user_id end,
      last_activity_at = now(),
      status = case
        when status = 'cancelled' then status
        when (select count(*) from public.match_lobby_members m
              where m.lobby_id = p_lobby_id and m.member_kind = 'player') = 0
          then 'cancelled'
        when (select count(*) from public.match_lobby_members m
              where m.lobby_id = p_lobby_id and m.member_kind = 'player') < 10
          then 'searching'
        when host_user_id is null or host_user_id = p_user_id then 'host_needed'
        else status
      end
  where id = p_lobby_id;

  return true;
end;
$$;

revoke all on function public.mm_kick_lobby_member(uuid, uuid, text) from public, anon;
grant execute on function public.mm_kick_lobby_member(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
