CREATE OR REPLACE FUNCTION public.user_can_access_family(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'admin')
    OR EXISTS (SELECT 1 FROM public.families f WHERE f.id = _family_id AND f.profile_id = _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.care_shifts s
      JOIN public.care_recipients r ON r.id = s.care_recipient_id
      JOIN public.caregivers c ON c.id = s.caregiver_id
      WHERE r.family_id = _family_id AND c.profile_id = _user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_family(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_family(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.family_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX family_messages_family_created_idx ON public.family_messages (family_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.family_messages TO authenticated;
GRANT ALL ON public.family_messages TO service_role;

ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread members can read family messages"
ON public.family_messages FOR SELECT TO authenticated
USING (public.user_can_access_family(auth.uid(), family_id));

CREATE POLICY "Thread members can post as themselves"
ON public.family_messages FOR INSERT TO authenticated
WITH CHECK (sender_profile_id = auth.uid() AND public.user_can_access_family(auth.uid(), family_id));

CREATE POLICY "Senders and admins can update their messages"
ON public.family_messages FOR UPDATE TO authenticated
USING (sender_profile_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (sender_profile_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER family_messages_touch BEFORE UPDATE ON public.family_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.family_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_messages;