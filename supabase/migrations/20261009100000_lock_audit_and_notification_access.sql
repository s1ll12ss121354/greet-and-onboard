-- ReCorN: close default EXECUTE grants on sensitive SECURITY DEFINER RPCs.
-- Safe to rerun; no application data is changed.
-- log_activity already validates auth.uid() in its body; this also makes the
-- privilege boundary explicit at the PostgreSQL grant layer.
revoke all on function public.log_activity(text, text, jsonb) from public, anon;
grant execute on function public.log_activity(text, text, jsonb) to authenticated;

-- mm_expire_unready validates auth.uid() and requires the caller to be a player
-- in the target lobby. Keep it authenticated-only at the SQL privilege layer.
revoke all on function public.mm_expire_unready(uuid) from public, anon;
grant execute on function public.mm_expire_unready(uuid) to authenticated;

-- Host notifications are private to their recipient. Recreate the narrow
-- policies to remove any stale permissive policy that could broaden access.
alter table public.host_notifications enable row level security;
revoke all on public.host_notifications from anon;
grant select, update on public.host_notifications to authenticated;

drop policy if exists "Users can read own host notifications" on public.host_notifications;
create policy "Users can read own host notifications"
on public.host_notifications
for select
to authenticated
using (host_user_id = (select auth.uid()));

drop policy if exists "Users can update own host notifications" on public.host_notifications;
create policy "Users can update own host notifications"
on public.host_notifications
for update
to authenticated
using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));

notify pgrst, 'reload schema';
