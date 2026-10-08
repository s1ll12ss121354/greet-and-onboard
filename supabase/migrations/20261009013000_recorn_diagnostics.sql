-- ReCorN diagnostic-only migration.
-- This migration creates ONE read-only diagnostic function.
-- It does not modify application tables, rows, roles, policies, or Storage data.
--
-- After running it in Supabase SQL Editor:
--   select * from public.recorn_diagnostics()
--   order by severity desc, category, object_name;
--
-- status:
--   PASS   = dependency exists
--   WARN   = optional/expected-but-not-critical dependency is missing
--   FAIL   = a dependency used by the current app/security flow is missing

create or replace function public.recorn_diagnostics()
returns table (
  severity text,
  category text,
  object_name text,
  status text,
  details text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- -------------------------------------------------------------------------
  -- Core tables
  -- -------------------------------------------------------------------------
  return query
  select
    'FAIL'::text,
    'table'::text,
    x.table_name,
    'MISSING'::text,
    'Required application table is missing.'::text
  from (
    values
      ('profiles'),
      ('user_roles'),
      ('match_lobbies'),
      ('match_lobby_members'),
      ('match_lobby_map_votes'),
      ('match_results'),
      ('match_result_players'),
      ('host_notifications'),
      ('host_applications'),
      ('reports'),
      ('activity_logs'),
      ('security_rate_limits')
  ) as x(table_name)
  where not exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = x.table_name
  );

  return query
  select
    'PASS'::text,
    'table'::text,
    x.table_name,
    'OK'::text,
    'Table exists.'::text
  from (
    values
      ('profiles'),
      ('user_roles'),
      ('match_lobbies'),
      ('match_lobby_members'),
      ('match_lobby_map_votes'),
      ('match_results'),
      ('match_result_players'),
      ('host_notifications'),
      ('host_applications'),
      ('reports'),
      ('activity_logs'),
      ('security_rate_limits')
  ) as x(table_name)
  where exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = x.table_name
  );

  -- -------------------------------------------------------------------------
  -- Profiles columns
  -- -------------------------------------------------------------------------
  return query
  select
    'FAIL'::text,
    'column'::text,
    'profiles.' || x.column_name,
    'MISSING'::text,
    'Column expected by the current app/security code is missing.'::text
  from (
    values
      ('id'),
      ('nickname'),
      ('elo'),
      ('wins'),
      ('losses'),
      ('banned'),
      ('last_seen_at'),
      ('support_priority'),
      ('avatar_url'),
      ('banner_url')
  ) as x(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = x.column_name
  );

  -- -------------------------------------------------------------------------
  -- Matchmaking columns
  -- -------------------------------------------------------------------------
  return query
  select
    'FAIL'::text,
    'column'::text,
    'match_lobbies.' || x.column_name,
    'MISSING'::text,
    'Matchmaking requires this column.'::text
  from (
    values
      ('id'),
      ('creator_id'),
      ('status'),
      ('target_players'),
      ('max_players'),
      ('search_started_at'),
      ('last_activity_at'),
      ('host_user_id'),
      ('selected_map')
  ) as x(column_name)
  where exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'match_lobbies'
  )
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'match_lobbies'
      and c.column_name = x.column_name
  );

  return query
  select
    'FAIL'::text,
    'column'::text,
    'match_lobby_members.' || x.column_name,
    'MISSING'::text,
    'Lobby roster/team logic requires this column.'::text
  from (
    values
      ('id'),
      ('lobby_id'),
      ('user_id'),
      ('member_kind'),
      ('team'),
      ('joined_at')
  ) as x(column_name)
  where exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'match_lobby_members'
  )
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'match_lobby_members'
      and c.column_name = x.column_name
  );

  -- -------------------------------------------------------------------------
  -- Result tables
  -- -------------------------------------------------------------------------
  return query
  select
    'FAIL'::text,
    'column'::text,
    'match_results.' || x.column_name,
    'MISSING'::text,
    'Match result submission requires this column.'::text
  from (
    values
      ('id'),
      ('lobby_id'),
      ('submitted_by'),
      ('screenshot_path')
  ) as x(column_name)
  where exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'match_results'
  )
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'match_results'
      and c.column_name = x.column_name
  );

  return query
  select
    'FAIL'::text,
    'column'::text,
    'match_result_players.' || x.column_name,
    'MISSING'::text,
    'Match result player statistics require this column.'::text
  from (
    values
      ('result_id'),
      ('user_id'),
      ('kills'),
      ('deaths'),
      ('won'),
      ('kd'),
      ('elo_delta')
  ) as x(column_name)
  where exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'match_result_players'
  )
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'match_result_players'
      and c.column_name = x.column_name
  );

  -- -------------------------------------------------------------------------
  -- RPC existence. We intentionally check by name only so this diagnostic
  -- never fails because an older signature is still installed.
  -- -------------------------------------------------------------------------
  return query
  select
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = x.function_name
      )
      then 'PASS'
      else 'FAIL'
    end,
    'rpc',
    x.function_name,
    case
      when exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = x.function_name
      )
      then 'EXISTS'
      else 'MISSING'
    end,
    x.details
  from (
    values
      ('mm_search_lobby', 'Matchmaking search RPC.'),
      ('mm_create_lobby', 'Manual lobby creation RPC.'),
      ('mm_join_lobby', 'Lobby join RPC.'),
      ('mm_leave_lobby', 'Lobby leave RPC.'),
      ('mm_open_lobbies', 'Open lobby discovery RPC.'),
      ('mm_vote_map', 'Map voting RPC.'),
      ('mm_assign_teams', '5v5 team assignment RPC.'),
      ('mm_start_ready_check', 'Match start transition RPC.'),
      ('submit_match_result', 'Server-side match result RPC.'),
      ('public_leaderboard', 'Safe public leaderboard RPC.'),
      ('touch_presence', 'Server-side presence update RPC.'),
      ('is_recorn_owner', 'Owner identity helper.'),
      ('has_role', 'Role lookup helper.'),
      ('is_active_ban', 'Ban lookup helper.')
  ) as x(function_name, details);

  -- -------------------------------------------------------------------------
  -- Storage buckets
  -- -------------------------------------------------------------------------
  return query
  select
    case
      when exists (
        select 1
        from storage.buckets b
        where b.id = x.bucket_id
      )
      then 'PASS'
      else 'FAIL'
    end,
    'storage'::text,
    x.bucket_id,
    case
      when exists (
        select 1
        from storage.buckets b
        where b.id = x.bucket_id
      )
      then 'EXISTS'
      else 'MISSING'
    end,
    x.details
  from (
    values
      ('profile-media', 'Profile avatar/banner storage bucket.'),
      ('match-screenshots', 'Match result screenshot bucket.')
  ) as x(bucket_id, details);

  -- -------------------------------------------------------------------------
  -- RLS enabled checks
  -- -------------------------------------------------------------------------
  return query
  select
    case
      when c.relrowsecurity then 'PASS'
      else 'FAIL'
    end,
    'rls'::text,
    'public.' || c.relname,
    case
      when c.relrowsecurity then 'ENABLED'
      else 'DISABLED'
    end,
    'Exposed application table should have RLS enabled.'::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'profiles',
      'user_roles',
      'match_lobbies',
      'match_lobby_members',
      'match_lobby_map_votes',
      'match_results',
      'match_result_players',
      'host_notifications',
      'host_applications',
      'reports',
      'activity_logs',
      'security_rate_limits'
    )
    and c.relkind = 'r';

  -- -------------------------------------------------------------------------
  -- Key policies exist
  -- -------------------------------------------------------------------------
  return query
  select
    case
      when exists (
        select 1
        from pg_policies p
        where p.schemaname = x.schema_name
          and p.tablename = x.table_name
          and p.policyname = x.policy_name
      )
      then 'PASS'
      else 'WARN'
    end,
    'policy'::text,
    x.table_name || ':' || x.policy_name,
    case
      when exists (
        select 1
        from pg_policies p
        where p.schemaname = x.schema_name
          and p.tablename = x.table_name
          and p.policyname = x.policy_name
      )
      then 'EXISTS'
      else 'MISSING'
    end,
    x.details
  from (
    values
      ('public','profiles','Users and admins read profiles','Profile read access is restricted to self/admin; lobby access uses a safe RPC.'),
      ('public','profiles','Admins update profiles','Competitive fields require server/admin control.'),
      ('public','match_lobbies','Lobby members can read their lobby','Lobby visibility should be scoped to participants.'),
      ('public','match_lobby_members','Lobby members can read lobby roster','Roster visibility should be scoped.'),
      ('public','match_lobby_map_votes','Lobby members can read map votes','Map votes should be scoped.'),
      ('public','match_results','Participants and staff read match results','Result visibility should be scoped.'),
      ('public','match_result_players','Participants and staff read result players','Player-result visibility should be scoped.')
  ) as x(schema_name, table_name, policy_name, details);

  -- -------------------------------------------------------------------------
  -- Obvious schema mismatch checks.
  -- -------------------------------------------------------------------------
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'ban_until'
  ) then
    return query
    select
      'WARN'::text,
      'schema'::text,
      'profiles.ban_until'::text,
      'EXTRA_COLUMN'::text,
      'This column is not used by the current code; old migrations may reference it.'::text;
  end if;

  return query
  select
    'PASS'::text,
    'schema'::text,
    'profiles.ban_until'::text,
    'NOT_PRESENT'::text,
    'Current code uses profiles.banned only.'::text
  where not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'ban_until'
  );

  -- -------------------------------------------------------------------------
  -- Security-definer functions with search_path problems.
  -- -------------------------------------------------------------------------
  return query
  select
    'FAIL'::text,
    'security'::text,
    n.nspname || '.' || p.proname,
    'UNSAFE_SEARCH_PATH'::text,
    'SECURITY DEFINER function does not pin search_path to an empty string.'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%';

  -- -------------------------------------------------------------------------
  -- Function execution grants: catch public/anon exposure of sensitive RPCs.
  -- -------------------------------------------------------------------------
  return query
  select
    case
      when has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('public', p.oid, 'EXECUTE')
      then 'FAIL'
      else 'PASS'
    end,
    'rpc_grants'::text,
    n.nspname || '.' || p.proname,
    case
      when has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('public', p.oid, 'EXECUTE')
      then 'PUBLIC_EXECUTE'
      else 'SCOPED'
    end,
    'Sensitive authenticated RPC should not be executable by anon/public.'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'mm_search_lobby',
      'mm_create_lobby',
      'mm_join_lobby',
      'mm_leave_lobby',
      'mm_vote_map',
      'mm_start_ready_check',
      'mm_assign_teams',
      'submit_match_result',
      'touch_presence',
      'submit_report',
      'submit_host_application',
      'is_active_ban',
      'has_role'
    );

end;
$$;

revoke all on function public.recorn_diagnostics() from public, anon;
grant execute on function public.recorn_diagnostics() to authenticated;

notify pgrst, 'reload schema';

-- The migration is intentionally non-destructive.
-- Run this separately after applying it:
-- select * from public.recorn_diagnostics()
-- order by
--   case severity when 'FAIL' then 1 when 'WARN' then 2 else 3 end,
--   category,
--   object_name;