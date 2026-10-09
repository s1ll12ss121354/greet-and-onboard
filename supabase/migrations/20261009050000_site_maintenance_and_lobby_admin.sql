-- ReCorN: owner-controlled maintenance mode and admin/owner lobby closure.
-- The maintenance state contains no private data and is exposed only via a
-- narrow read RPC. Changes are accepted only from the verified site owner.

CREATE TABLE IF NOT EXISTS public.recorn_site_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.recorn_site_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recorn_site_control FROM PUBLIC, anon, authenticated;

INSERT INTO public.recorn_site_control (id, maintenance_enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_site_maintenance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT s.maintenance_enabled
     FROM public.recorn_site_control AS s
     WHERE s.id = true),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.get_site_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_maintenance() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_set_site_maintenance(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT public.is_recorn_owner(actor) THEN
    RAISE EXCEPTION 'OWNER_ONLY';
  END IF;

  UPDATE public.recorn_site_control
  SET maintenance_enabled = p_enabled,
      updated_at = now(),
      updated_by = actor
  WHERE id = true;

  RETURN p_enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_set_site_maintenance(boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_set_site_maintenance(boolean)
TO authenticated;

-- Admins and the site owner may remove a lobby from the active list.
-- We mark it cancelled instead of hard-deleting its row, preserving any
-- match history and related audit evidence.
CREATE OR REPLACE FUNCTION public.admin_close_lobby(p_lobby_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT public.is_recorn_owner(actor)
     AND NOT public.has_role(actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_OR_OWNER_ONLY';
  END IF;

  PERFORM 1
  FROM public.match_lobbies AS l
  WHERE l.id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOBBY_NOT_FOUND';
  END IF;

  UPDATE public.match_lobbies
  SET status = 'cancelled',
      host_user_id = NULL,
      last_activity_at = now(),
      ready_check_started_at = NULL
  WHERE id = p_lobby_id;

  UPDATE public.host_notifications
  SET status = 'dismissed'
  WHERE lobby_id = p_lobby_id
    AND status = 'unread';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_close_lobby(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_close_lobby(uuid)
TO authenticated;

NOTIFY pgrst, 'reload schema';
