-- ReCorN: restore the profile avatar/banner RPC used by src/routes/profile.tsx.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists banner_url text;

drop function if exists public.update_profile_media(text, text);

create function public.update_profile_media(
  p_avatar_url text default null,
  p_banner_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.profiles
  set
    avatar_url = nullif(trim(p_avatar_url), ''),
    banner_url = nullif(trim(p_banner_url), '')
  where id = uid;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return true;
end;
$$;

revoke all on function public.update_profile_media(text, text) from public;
grant execute on function public.update_profile_media(text, text) to authenticated;

notify pgrst, 'reload schema';
