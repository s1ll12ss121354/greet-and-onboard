-- ReCorN: expire only genuinely empty lobbies after 15 minutes.
-- The scheduled cron job already calls public.close_idle_lobbies(); replacing
-- the function updates its behavior without creating another cron job.
-- Lobbies with any members, including spectators, are preserved.

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
      AND NOT EXISTS (
        SELECT 1
        FROM public.match_lobby_members AS m
        WHERE m.lobby_id = l.id
      )
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

NOTIFY pgrst, 'reload schema';
