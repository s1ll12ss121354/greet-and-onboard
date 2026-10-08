-- Supporter priority: an admin can verify a donation and enable priority
-- for reports and host applications. Payment verification remains manual because
-- the public donation link does not provide a trusted callback in this project.

alter table public.profiles
  add column if not exists support_priority boolean not null default false;

alter table public.host_applications
  add column if not exists priority boolean not null default false;

create index if not exists host_applications_priority_created_idx
  on public.host_applications(priority desc, created_at desc);

create or replace function public.set_host_application_priority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.priority := exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.support_priority = true
  );
  return new;
end;
$$;

drop trigger if exists host_application_priority on public.host_applications;
create trigger host_application_priority
before insert on public.host_applications
for each row execute function public.set_host_application_priority();

create or replace function public.set_report_priority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.priority := exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.support_priority = true
  ) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = new.user_id
  );
  return new;
end;
$$;

drop trigger if exists reports_priority on public.reports;
create trigger reports_priority
before insert on public.reports
for each row execute function public.set_report_priority();

create or replace function public.admin_set_support_priority(
  p_user_id uuid,
  p_enabled boolean
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

  update public.profiles
  set support_priority = p_enabled
  where id = p_user_id;

  update public.host_applications
  set priority = p_enabled
  where user_id = p_user_id and status = 'pending';

  insert into public.activity_logs(user_id,event_type,path,details)
  values(
    uid,
    case when p_enabled then 'support_priority_enabled' else 'support_priority_disabled' end,
    '/admin',
    jsonb_build_object('target_user_id',p_user_id)
  );

  return true;
end;
$$;

revoke execute on function public.admin_set_support_priority(uuid,boolean) from public, anon;
grant execute on function public.admin_set_support_priority(uuid,boolean) to authenticated;
