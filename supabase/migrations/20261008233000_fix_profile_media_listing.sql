-- ReCorN security fix:
-- Keep profile-media files publicly retrievable by known URL,
-- but do NOT allow public listing of the bucket contents.
--
-- Public buckets already bypass RLS for object retrieval/download.
-- The SELECT policy below was also granting object.list to everyone.
-- Removing that policy blocks bucket enumeration while preserving
-- public image URLs and the existing authenticated upload/update/delete policies.

drop policy if exists "Profile media public read" on storage.objects;

-- Intentionally no public SELECT policy for profile-media.
-- Direct public URLs continue to work because the bucket remains public.
-- Storage listing now requires a matching storage.objects SELECT policy,
-- so anonymous users cannot enumerate profile-media files.

notify pgrst, 'reload schema';