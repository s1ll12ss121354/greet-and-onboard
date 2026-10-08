-- Harden activity logging: ordinary users can only create page-view events,
-- while privileged audit events are accepted only from admins or the trusted RPCs.
create or replace function public.log_activity(
  p_event_type text,
  p_path text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  event_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_event_type is null
     or char_length(trim(p_event_type)) = 0
     or char_length(p_event_type) > 64 then
    raise exception 'INVALID_EVENT_TYPE';
  end if;

  if trim(p_event_type) <> 'page_view'
     and not public.has_role(uid, 'admin') then
    raise exception 'AUDIT_EVENT_FORBIDDEN';
  end if;

  if trim(p_event_type) = 'page_view'
     and exists (
       select 1 from public.activity_logs
       where user_id = uid
         and event_type = 'page_view'
         and coalesce(path, '') = coalesce(nullif(left(coalesce(p_path, ''), 200), ''), '')
         and created_at > now() - interval '5 seconds'
     ) then
    return null;
  end if;

  insert into public.activity_logs(user_id, event_type, path, details)
  values (
    uid,
    trim(p_event_type),
    nullif(left(coalesce(p_path, ''), 200), ''),
    case
      when trim(p_event_type) = 'page_view' then '{}'::jsonb
      when jsonb_typeof(coalesce(p_details, '{}'::jsonb)) = 'object' then coalesce(p_details, '{}'::jsonb)
      else '{}'::jsonb
    end
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke execute on function public.log_activity(text,text,jsonb) from public, anon;
grant execute on function public.log_activity(text,text,jsonb) to authenticated;

-- Non-admins cannot modify the supporter flag even if a broader UPDATE grant exists.
create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_role((select auth.uid()), 'admin') then
    return new;
  end if;

  if (select auth.uid()) is distinct from old.id then
    raise exception 'PROFILE_UPDATE_FORBIDDEN';
  end if;

  if new.id is distinct from old.id
     or new.nickname is distinct from old.nickname
     or new.created_at is distinct from old.created_at
     or new.support_priority is distinct from old.support_priority then
    raise exception 'PROFILE_FIELDS_PROTECTED';
  end if;

  return new;
end;
$$;
