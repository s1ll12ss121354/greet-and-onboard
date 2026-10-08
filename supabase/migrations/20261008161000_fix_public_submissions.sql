-- Reliable public submission RPCs avoid fragile direct table INSERT policies.
create or replace function public.submit_host_application(
  p_vip boolean,
  p_reason text,
  p_discord text default null,
  p_telegram text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  nick text;
  app_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select nickname into nick from public.profiles where id = uid;
  if nick is null then raise exception 'PROFILE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_discord,'')),'') is null and nullif(trim(coalesce(p_telegram,'')),'') is null then
    raise exception 'CONTACT_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_reason,''))) < 20 then
    raise exception 'REASON_TOO_SHORT';
  end if;
  if exists(select 1 from public.host_applications where user_id=uid and status in ('pending','approved')) then
    raise exception 'ACTIVE_APPLICATION_EXISTS';
  end if;

  insert into public.host_applications(
    user_id, roblox_nick, has_vip, reason, discord_contact, telegram_contact, accepted_rules, status
  )
  values(
    uid, trim(nick), coalesce(p_vip,false), left(trim(p_reason),2000),
    nullif(trim(coalesce(p_discord,'')),''),
    nullif(trim(coalesce(p_telegram,'')),''),
    true, 'pending'
  )
  returning id into app_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'host_application_submitted','/host',jsonb_build_object('application_id',app_id));
  return app_id;
end;
$$;

revoke execute on function public.submit_host_application(boolean,text,text,text) from public, anon;
grant execute on function public.submit_host_application(boolean,text,text,text) to authenticated;

create or replace function public.submit_report(
  p_target_nick text,
  p_reason text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  report_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_target_nick,''))) < 1 then raise exception 'TARGET_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 1 then raise exception 'REASON_REQUIRED'; end if;
  if char_length(trim(coalesce(p_details,''))) < 5 then raise exception 'DETAILS_REQUIRED'; end if;

  insert into public.reports(user_id,target_nick,reason,details,status)
  values(uid,left(trim(p_target_nick),100),left(trim(p_reason),100),left(trim(p_details),4000),'open')
  returning id into report_id;

  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'report_submitted','/reports',jsonb_build_object('report_id',report_id,'target_nick',left(trim(p_target_nick),100)));
  return report_id;
end;
$$;

revoke execute on function public.submit_report(text,text,text) from public, anon;
grant execute on function public.submit_report(text,text,text) to authenticated;
