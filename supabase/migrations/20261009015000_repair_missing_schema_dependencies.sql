-- ReCorN: repair missing schema dependencies discovered by recorn_diagnostics.
-- Safe/idempotent. This migration does not delete user data.
--
-- It repairs the exact missing pieces reported by the diagnostic:
--   profiles.last_seen_at
--   profiles.ban_until / ban_reason
--   public.security_rate_limits
--   public.match_results
--   public.match_result_players
--
-- The main security migration 20261009010000_top_security_hardening.sql
-- was also patched to consume these dependencies safely.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists ban_until timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_ban_until_idx
  on public.profiles(ban_until);

create table if not exists public.security_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (user_id, action)
);

alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public, anon, authenticated;

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.match_lobbies(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  screenshot_path text,
  created_at timestamptz not null default now(),
  unique (lobby_id)
);

create table if not exists public.match_result_players (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.match_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kills integer not null check (kills >= 0 and kills <= 999),
  deaths integer not null check (deaths >= 0 and deaths <= 999),
  won boolean not null default false,
  kd numeric(10,3) not null,
  elo_delta integer not null,
  unique (result_id, user_id)
);

alter table public.match_results enable row level security;
alter table public.match_result_players enable row level security;

revoke all on public.match_results from public, anon, authenticated;
revoke all on public.match_result_players from public, anon, authenticated;

grant select on public.match_results to authenticated;
grant select on public.match_result_players to authenticated;

notify pgrst, 'reload schema';