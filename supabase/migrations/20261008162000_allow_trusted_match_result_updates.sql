-- Match result RPC is trusted after validating the host and lobby.
-- Use a transaction-local GUC so existing profile protection triggers stay closed to normal clients.
create or replace function public.protect_profile_competitive_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('recorn.match_result', true) = '1' then
    return new;
  end if;
  if (new.elo is distinct from old.elo
      or new.wins is distinct from old.wins
      or new.losses is distinct from old.losses
      or new.banned is distinct from old.banned)
     and not public.has_role((select auth.uid()), 'admin') then
    raise exception 'COMPETITIVE_FIELDS_PROTECTED';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('recorn.match_result', true) = '1' then
    return new;
  end if;
  if public.has_role((select auth.uid()), 'admin') then
    return new;
  end if;
  if (select auth.uid()) is distinct from old.id then
    raise exception 'PROFILE_UPDATE_FORBIDDEN';
  end if;
  if new.nickname is distinct from old.nickname then
    raise exception 'NICKNAME_CHANGE_FORBIDDEN';
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

create or replace function public.submit_match_result(
  p_lobby_id uuid,
  p_screenshot_path text,
  p_players jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_result_id uuid;
  lobby_host uuid;
  lobby_status text;
  item jsonb;
  player_id uuid;
  kills integer;
  deaths integer;
  won boolean;
  kd numeric;
  delta integer;
  base_delta integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select host_user_id, status into lobby_host, lobby_status
  from public.match_lobbies where id = p_lobby_id for update;
  if lobby_host is null or lobby_host <> uid then raise exception 'HOST_ONLY'; end if;
  if lobby_status not in ('ready','in_game','full','host_needed') then raise exception 'MATCH_NOT_READY'; end if;
  if p_screenshot_path is null or char_length(trim(p_screenshot_path)) = 0 then raise exception 'SCREENSHOT_REQUIRED'; end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) < 2 then raise exception 'INVALID_RESULT'; end if;
  if exists(select 1 from public.match_results where lobby_id = p_lobby_id) then raise exception 'RESULT_ALREADY_SUBMITTED'; end if;

  perform set_config('recorn.match_result','1',true);

  insert into public.match_results(lobby_id,submitted_by,screenshot_path)
  values(p_lobby_id,uid,left(trim(p_screenshot_path),500))
  returning id into v_result_id;

  for item in select * from jsonb_array_elements(p_players) loop
    player_id := (item->>'user_id')::uuid;
    kills := greatest(0,least(999,coalesce((item->>'kills')::integer,0)));
    deaths := greatest(0,least(999,coalesce((item->>'deaths')::integer,0)));
    won := coalesce((item->>'won')::boolean,false);

    if not exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=player_id and member_kind='player') then
      raise exception 'PLAYER_NOT_IN_LOBBY';
    end if;

    kd := round(kills::numeric / greatest(deaths,1)::numeric,3);
    base_delta := case when won then 20 else -20 end;
    delta := greatest(-50,least(50,base_delta + round(greatest(-2,least(2,kd-1))*10)::integer));

    insert into public.match_result_players(result_id,user_id,kills,deaths,won,kd,elo_delta)
    values(v_result_id,player_id,kills,deaths,won,kd,delta);

    update public.profiles
    set elo=greatest(0,elo+delta),
        wins=wins+case when won then 1 else 0 end,
        losses=losses+case when won then 0 else 1 end
    where id=player_id;
  end loop;

  if (select count(*) from public.match_result_players mrp where mrp.result_id=v_result_id)
     <> (select count(*) from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player') then
    raise exception 'RESULT_MISSING_PLAYERS';
  end if;

  update public.match_lobbies set status='cancelled',last_activity_at=now() where id=p_lobby_id;
  insert into public.activity_logs(user_id,event_type,path,details)
  values(uid,'match_result_submitted','/matchmaking',jsonb_build_object('lobby_id',p_lobby_id,'result_id',v_result_id));
  return v_result_id;
exception when others then
  if v_result_id is not null then delete from public.match_results where id=v_result_id; end if;
  raise;
end;
$$;

revoke execute on function public.submit_match_result(uuid,text,jsonb) from public,anon;
grant execute on function public.submit_match_result(uuid,text,jsonb) to authenticated;
