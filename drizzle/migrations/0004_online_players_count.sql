-- Публичный счётчик игроков онлайн: профили, отмечавшие присутствие за последние 2 минуты.
create or replace function public.online_players_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.profiles
  where last_seen_at is not null
    and last_seen_at > now() - interval '2 minutes'
$$;

revoke all on function public.online_players_count() from public;
grant execute on function public.online_players_count() to anon, authenticated;
