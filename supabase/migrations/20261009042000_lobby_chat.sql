-- ReCorN: secure per-lobby chat with live updates.
-- Only current members can read chat history or post to that lobby.
-- No direct client writes: messages are sent through a validating RPC.

CREATE TABLE IF NOT EXISTS public.match_lobby_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.match_lobbies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (
    char_length(btrim(message)) BETWEEN 1 AND 500
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_lobby_chat_messages_lobby_created_idx
  ON public.match_lobby_chat_messages (lobby_id, created_at DESC);

ALTER TABLE public.match_lobby_chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.match_lobby_chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.match_lobby_chat_messages TO authenticated;

DROP POLICY IF EXISTS "Current lobby members read chat messages"
  ON public.match_lobby_chat_messages;

CREATE POLICY "Current lobby members read chat messages"
ON public.match_lobby_chat_messages
FOR SELECT TO authenticated
USING (
  public.is_recorn_lobby_member(lobby_id)
  AND EXISTS (
    SELECT 1
    FROM public.match_lobbies l
    WHERE l.id = match_lobby_chat_messages.lobby_id
      AND l.status <> 'cancelled'
  )
);

CREATE OR REPLACE FUNCTION public.lobby_chat_history(p_lobby_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nickname text,
  message text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT public.is_recorn_lobby_member(p_lobby_id) THEN
    RAISE EXCEPTION 'LOBBY_MEMBERS_ONLY';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_lobbies l
    WHERE l.id = p_lobby_id
      AND l.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'LOBBY_NOT_ACTIVE';
  END IF;

  RETURN QUERY
  SELECT recent.id,
         recent.user_id,
         COALESCE(p.nickname, 'Player')::text AS nickname,
         recent.message,
         recent.created_at
  FROM (
    SELECT c.id, c.user_id, c.message, c.created_at
    FROM public.match_lobby_chat_messages c
    WHERE c.lobby_id = p_lobby_id
    ORDER BY c.created_at DESC
    LIMIT 100
  ) AS recent
  LEFT JOIN public.profiles p ON p.id = recent.user_id
  ORDER BY recent.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_lobby_chat_message(
  p_lobby_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  clean_message text := btrim(COALESCE(p_message, ''));
  message_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF char_length(clean_message) < 1 OR char_length(clean_message) > 500 THEN
    RAISE EXCEPTION 'CHAT_MESSAGE_LENGTH';
  END IF;

  IF NOT public.is_recorn_lobby_member(p_lobby_id) THEN
    RAISE EXCEPTION 'LOBBY_MEMBERS_ONLY';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_lobbies l
    WHERE l.id = p_lobby_id
      AND l.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'LOBBY_NOT_ACTIVE';
  END IF;

  IF (
    SELECT count(*)
    FROM public.match_lobby_chat_messages c
    WHERE c.lobby_id = p_lobby_id
      AND c.user_id = uid
      AND c.created_at > now() - interval '5 seconds'
  ) >= 8 THEN
    RAISE EXCEPTION 'CHAT_RATE_LIMIT';
  END IF;

  INSERT INTO public.match_lobby_chat_messages (lobby_id, user_id, message)
  VALUES (p_lobby_id, uid, clean_message)
  RETURNING id INTO message_id;

  UPDATE public.match_lobbies
  SET last_activity_at = now()
  WHERE id = p_lobby_id;

  RETURN message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lobby_chat_history(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_lobby_chat_message(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lobby_chat_history(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_lobby_chat_message(uuid, text)
  TO authenticated;

-- Enable Realtime delivery for new messages when the standard Supabase
-- Realtime publication exists. The UI also refreshes periodically as fallback.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'match_lobby_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.match_lobby_chat_messages;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
