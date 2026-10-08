-- RECORN: fix matchmaking status constraint and add user profile media.
alter table public.match_lobbies drop constraint if exists match_lobbies_status_check;
alter table public.match_lobbies
  add constraint match_lobbies_status_check
  check (status in ('waiting','searching','full','host_needed','ready','ready_check','in_game','cancelled'));

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists banner_url text;

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Profile media public read" on storage.objects;
create policy "Profile media public read"
on storage.objects for select
to public
using (bucket_id = 'profile-media');

drop policy if exists "Users upload own profile media" on storage.objects;
create policy "Users upload own profile media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users update own profile media" on storage.objects;
create policy "Users update own profile media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users delete own profile media" on storage.objects;
create policy "Users delete own profile media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Only profile media fields are client-editable; competitive fields remain protected.
create or replace function public.update_profile_media(
  p_avatar_url text default null,
  p_banner_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.profiles
  set avatar_url = nullif(trim(p_avatar_url), ''),
      banner_url = nullif(trim(p_banner_url), '')
  where id = uid;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  return true;
end;
$$;

revoke execute on function public.update_profile_media(text,text) from public, anon;
grant execute on function public.update_profile_media(text,text) to authenticated;
