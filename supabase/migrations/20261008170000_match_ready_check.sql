-- ReCorN: map voting + host discovery + 60-second ready check before match start.
create table if not exists public.match_lobby_ready (
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ready boolean not null default false,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (lobby_id,user_id)
);
alter table public.match_lobby_ready enable row level security;
drop policy if exists "Lobby members can read ready state" on public.match_lobby_ready;
create policy "Lobby members can read ready state" on public.match_lobby_ready
for select to authenticated using (
  exists (select 1 from public.match_lobby_members m where m.lobby_id=match_lobby_ready.lobby_id and m.user_id=auth.uid())
);
drop policy if exists "Players can update own ready state" on public.match_lobby_ready;
create policy "Players can update own ready state" on public.match_lobby_ready
for insert to authenticated with check (
  user_id=auth.uid() and exists (select 1 from public.match_lobby_members m where m.lobby_id=match_lobby_ready.lobby_id and m.user_id=auth.uid() and m.member_kind='player')
);
drop policy if exists "Players can update own ready state 2" on public.match_lobby_ready;
create policy "Players can update own ready state 2" on public.match_lobby_ready
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

alter table public.match_lobbies add column if not exists ready_check_started_at timestamptz;

create or replace function public.mm_start_ready_check(p_lobby_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); pc integer; host_id uuid; selected text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid and member_kind='player') then raise exception 'PLAYER_ONLY'; end if;
 select count(*) into pc from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 select host_user_id,selected_map into host_id,selected from public.match_lobbies where id=p_lobby_id for update;
 if pc<10 then raise exception 'NEED_10_PLAYERS'; end if;
 if host_id is null then raise exception 'HOST_REQUIRED'; end if;
 if selected is null then raise exception 'MAP_REQUIRED'; end if;
 insert into public.match_lobby_ready(lobby_id,user_id,ready)
 select p_lobby_id,m.user_id,false from public.match_lobby_members m
 where m.lobby_id=p_lobby_id and m.member_kind='player'
 on conflict(lobby_id,user_id) do nothing;
 update public.match_lobbies set status='ready_check',ready_check_started_at=coalesce(ready_check_started_at,now()),last_activity_at=now()
 where id=p_lobby_id and status in ('ready','host_needed','full');
 return true;
end; $$;

create or replace function public.mm_set_ready(p_lobby_id uuid,p_ready boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); total integer; ready_count integer;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid and member_kind='player') then raise exception 'PLAYER_ONLY'; end if;
 if not exists(select 1 from public.match_lobbies where id=p_lobby_id and status='ready_check') then raise exception 'READY_CHECK_NOT_ACTIVE'; end if;
 update public.match_lobby_ready set ready=p_ready,responded_at=now() where lobby_id=p_lobby_id and user_id=uid;
 select count(*) into total from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 select count(*) into ready_count from public.match_lobby_ready where lobby_id=p_lobby_id and ready=true and user_id in (select user_id from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player');
 if total=10 and ready_count=10 then
   update public.match_lobbies set status='in_game',last_activity_at=now() where id=p_lobby_id;
 end if;
 return jsonb_build_object('ok',true,'ready',p_ready,'ready_count',ready_count,'total',total);
end; $$;

create or replace function public.mm_expire_unready(p_lobby_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); started timestamptz; kicked integer:=0; pc integer;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid and member_kind='player') then raise exception 'PLAYER_ONLY'; end if;
 select ready_check_started_at into started from public.match_lobbies where id=p_lobby_id;
 if started is null or started > now()-interval '60 seconds' then return jsonb_build_object('expired',false); end if;
 with gone as (
   delete from public.match_lobby_members m
   where m.lobby_id=p_lobby_id and m.member_kind='player'
     and not exists(select 1 from public.match_lobby_ready r where r.lobby_id=m.lobby_id and r.user_id=m.user_id and r.ready=true)
   returning m.user_id
 ) select count(*) into kicked from gone;
 delete from public.match_lobby_ready where lobby_id=p_lobby_id;
 delete from public.match_lobby_map_votes where lobby_id=p_lobby_id;
 update public.match_lobby_members set team=null where lobby_id=p_lobby_id;
 select count(*) into pc from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 update public.match_lobbies set selected_map=null,ready_check_started_at=null,status=case when pc>=10 then 'ready' else 'searching' end,last_activity_at=now() where id=p_lobby_id;
 return jsonb_build_object('expired',true,'kicked',kicked,'players',pc);
end; $$;

create or replace function public.mm_vote_map(p_lobby_id uuid,p_map_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); total_players integer; vote_count integer; winner text; host_id uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_map_name not in ('Mirage','Dust II','Nuke') then raise exception 'INVALID_MAP'; end if;
 select count(*) into total_players from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 if total_players<10 then raise exception 'NEED_10_PLAYERS'; end if;
 if exists(select 1 from public.match_lobbies where id=p_lobby_id and selected_map is not null) then raise exception 'MAP_ALREADY_SELECTED'; end if;
 if not exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid and member_kind='player') then raise exception 'PLAYER_ONLY'; end if;
 insert into public.match_lobby_map_votes(lobby_id,user_id,map_name) values(p_lobby_id,uid,p_map_name)
 on conflict(lobby_id,user_id) do update set map_name=excluded.map_name;
 select map_name,count(*)::integer into winner,vote_count from public.match_lobby_map_votes where lobby_id=p_lobby_id group by map_name order by count(*) desc,case map_name when 'Mirage' then 1 when 'Dust II' then 2 else 3 end limit 1;
 if vote_count>=6 then
   update public.match_lobbies set selected_map=winner,status=case when host_user_id is null then 'host_needed' else 'ready' end,last_activity_at=now() where id=p_lobby_id and selected_map is null;
   select host_user_id into host_id from public.match_lobbies where id=p_lobby_id;
   if host_id is not null then perform public.mm_start_ready_check(p_lobby_id); end if;
 end if;
 return jsonb_build_object('ok',true,'selected_map',(select selected_map from public.match_lobbies where id=p_lobby_id),'votes',(select count(*) from public.match_lobby_map_votes where lobby_id=p_lobby_id));
end; $$;

create or replace function public.mm_join_lobby(p_lobby_id uuid,p_spectator boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); is_host_plus boolean; is_admin boolean; total_count integer; player_count integer; result_kind text; selected text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if public.is_active_ban(uid) then raise exception 'PROFILE_REQUIRED'; end if;
 select exists(select 1 from public.user_roles where user_id=uid and role in ('host','moderator','admin')),exists(select 1 from public.user_roles where user_id=uid and role='admin') into is_host_plus,is_admin;
 select count(*) into total_count from public.match_lobby_members where lobby_id=p_lobby_id;
 select count(*) into player_count from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 if not exists(select 1 from public.match_lobbies where id=p_lobby_id and status<>'cancelled') then raise exception 'LOBBY_NOT_FOUND'; end if;
 if exists(select 1 from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid) then return jsonb_build_object('ok',true,'kind',(select member_kind from public.match_lobby_members where lobby_id=p_lobby_id and user_id=uid)); end if;
 if p_spectator then if not is_host_plus then raise exception 'STAFF_ONLY'; end if; if total_count>=10 and not is_admin then raise exception 'LOBBY_FULL'; end if; result_kind:='spectator';
 else if player_count>=10 and not is_admin then raise exception 'PLAYER_SLOTS_FULL'; end if; if total_count>=12 and not is_admin then raise exception 'LOBBY_FULL'; end if; result_kind:='player'; end if;
 insert into public.match_lobby_members(lobby_id,user_id,member_kind) values(p_lobby_id,uid,result_kind);
 if is_host_plus and result_kind='player' then
   update public.match_lobbies set host_user_id=case when is_admin then host_user_id else uid end,last_activity_at=now() where id=p_lobby_id;
 end if;
 select count(*) into player_count from public.match_lobby_members where lobby_id=p_lobby_id and member_kind='player';
 select selected_map into selected from public.match_lobbies where id=p_lobby_id;
 if player_count>=10 then
   perform public.mm_assign_teams(p_lobby_id);
   update public.match_lobbies set status=case when host_user_id is null then 'host_needed' else case when selected_map is null then 'ready' else 'ready' end end where id=p_lobby_id;
   if (select host_user_id from public.match_lobbies where id=p_lobby_id) is not null and selected is not null then perform public.mm_start_ready_check(p_lobby_id); end if;
 else update public.match_lobbies set status='searching',last_activity_at=now() where id=p_lobby_id and status not in ('in_game','cancelled'); end if;
 update public.host_notifications set status='read' where lobby_id=p_lobby_id and host_user_id=uid and status='unread';
 return jsonb_build_object('ok',true,'kind',result_kind);
end; $$;

revoke execute on function public.mm_start_ready_check(uuid) from public,anon;
revoke execute on function public.mm_set_ready(uuid,boolean) from public,anon;
revoke execute on function public.mm_expire_unready(uuid) from public,anon;
grant execute on function public.mm_start_ready_check(uuid) to authenticated;
grant execute on function public.mm_set_ready(uuid,boolean) to authenticated;
grant execute on function public.mm_expire_unready(uuid) to authenticated;
