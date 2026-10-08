-- Fix admin access to host applications and reports after RLS hardening.
-- All mutations stay behind server-side role checks.

grant select on public.host_applications to authenticated;
grant update on public.host_applications to authenticated;

drop policy if exists "Admins read host applications" on public.host_applications;
create policy "Admins read host applications"
on public.host_applications for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "Admins update host applications" on public.host_applications;
create policy "Admins update host applications"
on public.host_applications for update to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

grant select on public.reports to authenticated;

drop policy if exists "Admins read all reports" on public.reports;
create policy "Admins read all reports"
on public.reports for select to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create or replace function public.admin_review_host_application(
  p_application_id uuid,
  p_approve boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  applicant uuid;
  app_status text;
  nick text;
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  select user_id, status, roblox_nick
    into applicant, app_status, nick
  from public.host_applications
  where id = p_application_id
  for update;

  if applicant is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if app_status <> 'pending' then
    return true;
  end if;

  update public.host_applications
  set status = case when p_approve then 'approved' else 'rejected' end
  where id = p_application_id;

  if p_approve then
    insert into public.user_roles(user_id, role)
    values (applicant, 'host'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;

  insert into public.activity_logs(user_id,event_type,path,details)
  values (
    uid,
    case when p_approve then 'host_application_approved' else 'host_application_rejected' end,
    '/admin',
    jsonb_build_object(
      'application_id', p_application_id,
      'applicant', nick
    )
  );

  return true;
end;
$$;

revoke execute on function public.admin_review_host_application(uuid,boolean) from public, anon;
grant execute on function public.admin_review_host_application(uuid,boolean) to authenticated;

create or replace function public.admin_set_report_status(
  p_report_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_status not in ('open','resolved','rejected') then
    raise exception 'INVALID_REPORT_STATUS';
  end if;

  update public.reports
  set status = p_status
  where id = p_report_id;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(
    uid,
    'report_status_changed',
    '/admin',
    jsonb_build_object('report_id', p_report_id, 'status', p_status)
  );

  return true;
end;
$$;

revoke execute on function public.admin_set_report_status(uuid,text) from public, anon;
grant execute on function public.admin_set_report_status(uuid,text) to authenticated;
