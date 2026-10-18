CREATE TABLE public.clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 20),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  logo_path text,
  leader_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.clans.leader_id IS 'plain user uuid, references public.profiles.id';

CREATE UNIQUE INDEX clans_unique_name_lower ON public.clans (lower(trim(name)));
CREATE UNIQUE INDEX clans_one_active_per_leader ON public.clans (leader_id) WHERE status IN ('pending','approved');
CREATE INDEX clans_status_idx ON public.clans (status, created_at DESC);

CREATE TABLE public.clan_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('leader','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clan_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clans TO authenticated;
GRANT ALL ON public.clans TO service_role;
GRANT SELECT, INSERT, DELETE ON public.clan_members TO authenticated;
GRANT ALL ON public.clan_members TO service_role;

ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read approved or own or staff clans"
  ON public.clans FOR SELECT TO authenticated
  USING (status = 'approved' OR leader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Own pending clan application insert"
  ON public.clans FOR INSERT TO authenticated
  WITH CHECK (leader_id = auth.uid() AND status = 'pending');

CREATE POLICY "Leader deletes own pending application"
  ON public.clans FOR DELETE TO authenticated
  USING (leader_id = auth.uid() AND status = 'pending');

CREATE POLICY "Staff updates clans"
  ON public.clans FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Read clan roster of approved or own clan"
  ON public.clan_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_id AND (c.status = 'approved' OR c.leader_id = auth.uid())));

CREATE POLICY "Admins manage clan members"
  ON public.clan_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_review_clan_application(p_clan_id uuid, p_approve boolean, p_reject_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT (has_role(caller, 'admin') OR is_recorn_owner(caller)) THEN
    RAISE EXCEPTION 'Only admins can review clan applications';
  END IF;
  IF p_approve THEN
    UPDATE public.clans
      SET status = 'approved', reviewed_by = caller, reviewed_at = now(), reject_reason = NULL
      WHERE id = p_clan_id AND status = 'pending';
    IF NOT FOUND THEN RETURN FALSE; END IF;
    INSERT INTO public.clan_members (clan_id, user_id, member_role)
      SELECT p_clan_id, leader_id, 'leader' FROM public.clans WHERE id = p_clan_id
      ON CONFLICT (clan_id, user_id) DO NOTHING;
    RETURN TRUE;
  ELSE
    UPDATE public.clans
      SET status = 'rejected', reviewed_by = caller, reviewed_at = now(),
          reject_reason = COALESCE(p_reject_reason, 'Заявка отклонена администрацией')
      WHERE id = p_clan_id AND status = 'pending';
    RETURN FOUND;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_review_clan_application(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_clans()
RETURNS TABLE (id uuid, name text, description text, logo_path text, leader_nick text, members bigint, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, c.logo_path, p.nickname,
         (SELECT count(*) FROM public.clan_members m WHERE m.clan_id = c.id) AS members,
         c.created_at
  FROM public.clans c
  LEFT JOIN public.profiles p ON p.id = c.leader_id
  WHERE c.status = 'approved'
  ORDER BY members DESC, c.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.public_clans() TO authenticated;

CREATE POLICY "Users upload own clan logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clan-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own clan logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'clan-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'clan-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own clan logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'clan-logos' AND (storage.foldername(name))[1] = auth.uid()::text);