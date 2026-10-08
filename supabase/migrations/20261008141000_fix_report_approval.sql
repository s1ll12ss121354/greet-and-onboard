-- Fix report approval: approving a report must apply the moderation action.
-- The admin action bans the reported player by nickname and resolves the report.

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
  target text;
  target_id uuid;
begin
  if uid is null or not public.has_role(uid, 'admin') then
    raise exception 'ADMIN_ONLY';
  end if;

  if p_status not in ('resolved','rejected') then
    raise exception 'INVALID_REPORT_STATUS';
  end if;

  select r.target_nick
    into target
  from public.reports r
  where r.id = p_report_id
    and r.status = 'open'
  for update;

  if target is null then
    raise exception 'REPORT_NOT_OPEN';
  end if;

  if p_status = 'resolved' then
    select p.id
      into target_id
    from public.profiles p
    where lower(trim(p.nickname)) = lower(trim(target))
    limit 1;

    if target_id is null then
      raise exception 'TARGET_PROFILE_NOT_FOUND';
    end if;

    update public.profiles
    set banned = true
    where id = target_id;

    update public.reports
    set status = 'resolved'
    where id = p_report_id;
  else
    update public.reports
    set status = 'rejected'
    where id = p_report_id;
  end if;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(
    uid,
    case when p_status = 'resolved' then 'report_approved' else 'report_rejected' end,
    '/admin',
    jsonb_build_object(
      'report_id', p_report_id,
      'target_nick', target,
      'target_user_id', target_id
    )
  );

  return true;
end;
$$;

revoke execute on function public.admin_set_report_status(uuid,text) from public, anon;
grant execute on function public.admin_set_report_status(uuid,text) to authenticated;
