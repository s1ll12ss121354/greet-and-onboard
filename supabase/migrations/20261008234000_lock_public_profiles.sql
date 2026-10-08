-- ReCorN security fix:
-- Do not expose the profiles table to anonymous visitors.
-- Authenticated users still need profile rows for matchmaking/profile pages.

revoke select on public.profiles from anon;

drop policy if exists "Profiles are public" on public.profiles;

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null);

notify pgrst, 'reload schema';