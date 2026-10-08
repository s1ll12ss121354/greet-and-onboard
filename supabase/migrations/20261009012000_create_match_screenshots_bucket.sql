-- ReCorN: restore the match screenshot storage bucket.
-- The result form uploads to "match-screenshots".
-- Keep the bucket private: the result RPC verifies object ownership directly.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'match-screenshots',
  'match-screenshots',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Host can upload match screenshots" on storage.objects;

create policy "Host can upload match screenshots"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'match-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    public.has_role((select auth.uid()), 'host')
    or public.has_role((select auth.uid()), 'moderator')
    or public.has_role((select auth.uid()), 'admin')
    or exists (
      select 1
      from public.match_lobbies l
      where l.host_user_id = (select auth.uid())
        and storage.filename(name) like l.id::text || '-%'
    )
  )
);

drop policy if exists "Host can read match screenshots" on storage.objects;

create policy "Host can read match screenshots"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'match-screenshots'
  and owner_id = (select auth.uid())::text
);

notify pgrst, 'reload schema';