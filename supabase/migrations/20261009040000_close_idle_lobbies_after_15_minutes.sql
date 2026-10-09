-- ReCorN: automatically close idle matchmaking lobbies after 15 minutes.
-- Open lobby states are retired if no join, vote, host action, or other lobby
-- activity has updated last_activity_at for 15 minutes. In-game matches are
-- deliberately excluded. Runs in the database, even when nobody has the site open.

CREATE OR REPLACE FUNCTION public.close_idle_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  closed_count integer := 0;
BEGIN
  WITH stale AS (
    SELECT l.id
    FROM public.match_lobbies AS l
    WHERE l.status IN (
      'waiting',
      'searching',
      'full',
      'host_needed',
      'ready',
      'ready_check'
    )
      AND COALESCE(l.last_activity_at, l.created_at)
          <= now() - interval '15 minutes'
    FOR UPDATE SKIP LOCKED
  ),
  closed AS (
    UPDATE public.match_lobbies AS l
    SET status = 'cancelled',
        host_user_id = NULL,
        last_activity_at = now(),
        ready_check_started_at = NULL
    FROM stale
    WHERE l.id = stale.id
    RETURNING l.id
  ),
  dismissed_notifications AS (
    UPDATE public.host_notifications AS hn
    SET status = 'dismissed'
    WHERE hn.status = 'unread'
      AND hn.lobby_id IN (SELECT id FROM closed)
    RETURNING hn.id
  )
  SELECT count(*)::integer
  INTO closed_count
  FROM closed;

  RETURN closed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_idle_lobbies()
FROM PUBLIC, anon, authenticated;

-- pg_cron runs this cleanup every minute. Re-running the migration replaces
-- the existing job with one named recorn-close-idle-lobbies (no duplicates).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'recorn-close-idle-lobbies'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'recorn-close-idle-lobbies',
    '* * * * *',
    'SELECT public.close_idle_lobbies();'
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
