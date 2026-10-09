-- Недостающие колонки
alter table public.ban_requests add column if not exists report_id uuid references public.reports(id) on delete set null;
alter table public.ban_requests add column if not exists reviewed_by uuid;
alter table public.ban_requests add column if not exists reviewed_at timestamptz;
alter table public.host_applications add column if not exists priority boolean not null default false;
alter table public.host_applications add column if not exists discord_contact text;
alter table public.host_applications add column if not exists telegram_contact text;
alter table public.custom_roles add column if not exists description text not null default '';
alter table public.activity_logs add column if not exists path text;
alter table public.security_login_events add column if not exists device_category text;
alter table public.security_login_events add column if not exists browser text;
alter table public.security_login_events add column if not exists os text;
alter table public.security_login_events add column if not exists ip_hash text;
alter table public.match_lobby_members add column if not exists ready boolean not null default false;

-- Журнал активности
create or replace function public.log_activity(p_event_type text, p_path text default null, p_details jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into activity_logs (user_id, event_type, path, details)
  values (auth.uid(), p_event_type, p_path, coalesce(p_details, '{}'::jsonb));
  return true;
end $$;

-- Обработка заявки на хоста (только админ/владелец)
create or replace function public.admin_review_host_application(p_application_id uuid, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_app public.host_applications%rowtype;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_recorn_owner(auth.uid())) then
    raise exception 'forbidden';
  end if;
  select * into v_app from public.host_applications where id = p_application_id for update;
  if not found then raise exception 'not_found'; end if;
  update public.host_applications
    set status = case when p_approve then 'approved' else 'rejected' end
    where id = p_application_id;
  if p_approve then
    insert into public.user_roles (user_id, role) values (v_app.user_id, 'host')
    on conflict do nothing;
  end if;
  return true;
end $$;

-- Обработка жалобы с опциональным баном (админ/модератор)
create or replace function public.admin_set_report_status(p_report_id uuid, p_status text, p_ban_minutes int default null, p_ban_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_report public.reports%rowtype;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator') or public.is_recorn_owner(auth.uid())) then
    raise exception 'forbidden';
  end if;
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then raise exception 'not_found'; end if;
  update public.reports set status = p_status where id = p_report_id;
  if p_status = 'resolved' and p_ban_minutes is not null then
    update public.profiles set banned = true where nickname = v_report.target_nick;
  end if;
  return true;
end $$;

-- Приоритет поддержки (только админ/владелец)
create or replace function public.admin_set_support_priority(p_user_id uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_recorn_owner(auth.uid())) then
    raise exception 'forbidden';
  end if;
  update public.profiles set support_priority = p_enabled where id = p_user_id;
  return true;
end $$;

-- Запрос на бан от модератора
create or replace function public.request_report_ban(p_report_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_report public.reports%rowtype; v_id uuid;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator') or public.is_recorn_owner(auth.uid())) then
    raise exception 'forbidden';
  end if;
  select * into v_report from public.reports where id = p_report_id;
  if not found then raise exception 'not_found'; end if;
  insert into public.ban_requests (report_id, target_nick, requested_by, status)
  values (p_report_id, v_report.target_nick, auth.uid(), 'pending')
  returning id into v_id;
  return v_id;
end $$;

-- Решение администратора по запросу на бан
create or replace function public.review_ban_request(p_request_id uuid, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_req public.ban_requests%rowtype;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.is_recorn_owner(auth.uid())) then
    raise exception 'forbidden';
  end if;
  select * into v_req from public.ban_requests where id = p_request_id for update;
  if not found then raise exception 'not_found'; end if;
  update public.ban_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  if p_approve and v_req.target_nick is not null then
    update public.profiles set banned = true where nickname = v_req.target_nick;
  end if;
  return true;
end $$;

-- Готовность игрока в лобби
create or replace function public.mm_set_ready(p_lobby_id uuid, p_ready boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_total int; v_ready int;
begin
  update public.match_lobby_members
    set ready = p_ready
    where lobby_id = p_lobby_id and user_id = auth.uid() and member_kind = 'player';
  if not found then raise exception 'not_a_player'; end if;
  update public.match_lobbies set last_activity_at = now() where id = p_lobby_id;
  select count(*), count(*) filter (where ready) into v_total, v_ready
    from public.match_lobby_members
    where lobby_id = p_lobby_id and member_kind = 'player';
  if v_total >= 2 and v_total = v_ready then
    update public.match_lobbies set status = 'in_game' where id = p_lobby_id and status = 'ready_check';
  end if;
  return true;
end $$;

-- Исключение неподтвердивших готовность по таймеру
create or replace function public.mm_expire_unready(p_lobby_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.match_lobbies
    where id = p_lobby_id and status = 'ready_check'
      and ready_check_started_at < now() - interval '45 seconds'
  ) then
    return false;
  end if;
  delete from public.match_lobby_members
    where lobby_id = p_lobby_id and member_kind = 'player' and not ready;
  update public.match_lobbies
    set status = 'searching', ready_check_started_at = null, last_activity_at = now()
    where id = p_lobby_id;
  update public.match_lobby_members set ready = false where lobby_id = p_lobby_id;
  return true;
end $$;

grant execute on function public.log_activity(text, text, jsonb) to authenticated;
grant execute on function public.admin_review_host_application(uuid, boolean) to authenticated;
grant execute on function public.admin_set_report_status(uuid, text, int, text) to authenticated;
grant execute on function public.admin_set_support_priority(uuid, boolean) to authenticated;
grant execute on function public.request_report_ban(uuid) to authenticated;
grant execute on function public.review_ban_request(uuid, boolean) to authenticated;
grant execute on function public.mm_set_ready(uuid, boolean) to authenticated;
grant execute on function public.mm_expire_unready(uuid) to authenticated;