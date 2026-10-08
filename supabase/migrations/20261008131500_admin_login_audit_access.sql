-- Admins need the full device/login audit while ordinary users keep seeing only their own events.
drop policy if exists "Admins read all login events" on public.security_login_events;
create policy "Admins read all login events"
on public.security_login_events for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));
