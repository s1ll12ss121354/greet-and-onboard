-- ReCorN: reliable owner-only admin grant.
-- Owner account is identified by profile nickname: isy_hesy09.

create or replace function public.is_recorn_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and lower(trim(nickname)) = 'isy_hesy09'
  );
$$;

revoke all on function public.is_recorn_owner(uuid) from public, anon;
grant execute on function public.is_recorn_owner(uuid) to authenticated;

-- Make sure the owner itself has admin.
insert into public.user_roles (user_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
where lower(trim(p.nickname)) = 'isy_hesy09'
on conflict (user_id, role) do nothing;

create or replace function public.owner_grant_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  target_exists boolean;
begin
  if caller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not public.is_recorn_owner(caller_id) then
    raise exception 'OWNER_ONLY';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = p_user_id
  )
  into target_exists;

  if not target_exists then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  begin
    insert into public.activity_logs (user_id, event_type, path, details)
    values (
      caller_id,
      'admin_role_granted',
      '/admin',
      jsonb_build_object('target_user_id', p_user_id)
    );
  exception when others then
    -- Logging must not make the admin grant itself fail.
    null;
  end;

  return true;
end;
$$;

revoke all on function public.owner_grant_admin(uuid) from public, anon;
grant execute on function public.owner_grant_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
