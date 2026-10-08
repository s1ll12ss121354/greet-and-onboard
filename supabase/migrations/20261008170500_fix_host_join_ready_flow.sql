create or replace function public.mm_join_lobby(p_lobby_id uuid,p_spectator boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); is_host_plus boolean; is_admin boolean; total_count integer; player_count integer; result_kind text; selected text; current_host uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if public.is_active_ban(uid) then raise exception 'PROFILE_REQUIRED'; end if;
 select exists(select 1 from public.user_roles where user_id=uid and role in ('host','moderator','admin')),exists(select 1 from public.user_roles where user_id=uid and role='admin') into is_host_plus,is_admin;
 select count(*) into total_count from public.match_lobby_members where lobby_id=p_lobby_id;
 select count(*) into player_count from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 select host_user_id,selected_map into current_host,selected from public.match_lobbies where id=p_lobby_id and status<>'cancelled';
 if current_host is null and p_spectator and is_host_plus then
   result_kind:='spectator';
 elsif p_spectator then
   if not is_host_plus then raise exception 'STAFF_ONLY'; end if;
   if total_count>=10 and not is_admin then raise exception 'LOBBY_FULL'; end if;
   result_kind:='spectator';
 else
   if player_count>=10 and not is_admin then raise exception 'PLAYER_SLOTS_FULL'; end if;
   if total_count>=12 and not is_admin then raise exception 'LOBBY_FULL'; end if;
   result_kind:='player';
 end if;
 if not exists(select 1 from public.match_lobbies where id=p_lobby_id and status<>'cancelled') then raise exception 'LOBBY_NOT_FOUND'; end if;
 if exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid) then return jsonb_build_object('ok',true,'kind',(select member_kind from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid)); end if;
 insert into public.match_lobby_members(lobby_id,user_id,member_kind) values(p_lobby_id,uid,result_kind);
 if is_host_plus and current_host is null then
   update public.match_lobbies set host_user_id=uid,status=case when selected is null then 'ready' else 'ready' end,last_activity_at=now() where id=p_lobby_id;
 end if;
 select count(*) into player_count from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 select selected_map into selected from public.match_lobbies where id=p_lobby_id;
 if player_count>=10 then
   perform public.mm_assign_teams(p_lobby_id);
   update public.match_lobbies set status=case when host_user_id is null then 'host_needed' else case when selected_map is null then 'ready' else 'ready' end end,last_activity_at=now() where id=p_lobby_id;
   if (select host_user_id from public.match_lobbies where id=p_lobby_id) is not null and selected is not null then perform public.mm_start_ready_check(p_lobby_id); end if;
 end if;
 update public.host_notifications set status='read' where lobby_id=p_lobby_id and host_user_id=uid and status='unread';
 return jsonb_build_object('ok',true,'kind',result_kind);
end; $$;