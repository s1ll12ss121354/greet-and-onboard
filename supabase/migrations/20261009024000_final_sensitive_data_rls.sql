-- ReCorN: final sensitive-data and authorization RLS hardening.
-- Purpose:
--   1) Remove legacy broad policies that may still exist on a live database.
--   2) Keep profile/contact/audit data visible only to the intended audience.
--   3) Make user_roles writable only by admins; owner protection remains enforced
--      by protect_admin_role_changes().
--
-- Safe/idempotent: policies are replaced, no application rows are deleted.

-- ============================================================================
-- PROFILES
-- ============================================================================

alter table public.profiles enable row level security;

revoke select, insert, delete on public.profiles from anon;
revoke update on public.profiles from anon;

grant select, update on public.profiles to authenticated;

drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users admins and lobby members can read profiles" on public.profiles;
drop policy if exists "Users and admins read profiles" on public.profiles;

create policy "Users and admins read profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

drop policy if exists "Admins update profiles" on public.profiles;

create policy "Admins update profiles"
on public.profiles
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- ============================================================================
-- HOST APPLICATIONS: contains Discord/Telegram contact data.
-- ============================================================================

alter table public.host_applications enable row level security;

revoke all on public.host_applications from anon;
revoke insert, delete on public.host_applications from authenticated;
grant select, update on public.host_applications to authenticated;

drop policy if exists "Authenticated users can read host applications" on public.host_applications;
drop policy if exists "Users can read host applications" on public.host_applications;
drop policy if exists "Admins read host applications" on public.host_applications;
drop policy if exists "Admins update host applications" on public.host_applications;

create policy "Admins read host applications"
on public.host_applications
for select
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy "Admins update host applications"
on public.host_applications
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- ============================================================================
-- REPORTS: report text can contain sensitive player information.
-- ============================================================================

alter table public.reports enable row level security;

revoke all on public.reports from anon;
revoke insert, delete on public.reports from authenticated;
grant select, update on public.reports to authenticated;

drop policy if exists "Own or staff read" on public.reports;
drop policy if exists "Staff update" on public.reports;
drop policy if exists "Admins read all reports" on public.reports;
drop policy if exists "Authenticated users can read reports" on public.reports;
drop policy if exists "Users can read own reports" on public.reports;

create policy "Own or staff read"
on public.reports
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
);

create policy "Staff update"
on public.reports
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
)
with check (
  public.has_role((select auth.uid()), 'moderator')
  or public.has_role((select auth.uid()), 'admin')
);

-- ============================================================================
-- LOGIN EVENTS: device/IP metadata is private.
-- ============================================================================

alter table public.security_login_events enable row level security;

revoke all on public.security_login_events from anon;
revoke insert, update, delete on public.security_login_events from authenticated;
grant select on public.security_login_events to authenticated;

drop policy if exists "Users can read own login events" on public.security_login_events;
drop policy if exists "Admins read all login events" on public.security_login_events;
drop policy if exists "Authenticated users can read login events" on public.security_login_events;
drop policy if exists "Users can insert own login events" on public.security_login_events;

create policy "Users read own login events"
on public.security_login_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

-- Inserts are performed by the login-audit Edge Function/service role.
-- Do not allow clients to forge security login events.

-- ============================================================================
-- ACTIVITY LOGS: administrative audit trail.
-- ============================================================================

alter table public.activity_logs enable row level security;

revoke all on public.activity_logs from anon, authenticated;
grant select on public.activity_logs to authenticated;

drop policy if exists "Admins read activity logs" on public.activity_logs;
drop policy if exists "Authenticated users can read activity logs" on public.activity_logs;

create policy "Admins read activity logs"
on public.activity_logs
for select
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

-- ============================================================================
-- BAN REQUESTS: only moderators/admins need moderation data.
-- ============================================================================

alter table public.ban_requests enable row level security;

revoke all on public.ban_requests from anon, authenticated;
grant select on public.ban_requests to authenticated;

drop policy if exists "Staff read ban requests" on public.ban_requests;
drop policy if exists "Authenticated users can read ban requests" on public.ban_requests;

create policy "Staff read ban requests"
on public.ban_requests
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or public.has_role((select auth.uid()), 'moderator')
);

-- ============================================================================
-- USER ROLES: authorization data is self/admin-readable and admin-writable.
-- ============================================================================

alter table public.user_roles enable row level security;

revoke all on public.user_roles from anon;
revoke select, insert, update, delete on public.user_roles from authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;

drop policy if exists "Roles are public" on public.user_roles;
drop policy if exists "Users can read own roles" on public.user_roles;
drop policy if exists "Admins can manage roles" on public.user_roles;
drop policy if exists "Authenticated users can read roles" on public.user_roles;

create policy "Users can read own roles"
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

create policy "Admins insert roles"
on public.user_roles
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin')
);

create policy "Admins update roles"
on public.user_roles
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy "Admins delete roles"
on public.user_roles
for delete
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

-- ============================================================================
-- CUSTOM ROLES
-- ============================================================================

alter table public.custom_roles enable row level security;
alter table public.user_custom_roles enable row level security;

revoke all on public.custom_roles from anon, authenticated;
revoke all on public.user_custom_roles from anon, authenticated;

grant select on public.custom_roles to authenticated;
grant select on public.user_custom_roles to authenticated;

drop policy if exists "Authenticated read custom roles" on public.custom_roles;
drop policy if exists "Admins read custom roles" on public.custom_roles;

create policy "Admins read custom roles"
on public.custom_roles
for select
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "Authenticated read user custom roles" on public.user_custom_roles;
drop policy if exists "Users and admins read custom role assignments" on public.user_custom_roles;

create policy "Users and admins read custom role assignments"
on public.user_custom_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
);

notify pgrst, 'reload schema';
