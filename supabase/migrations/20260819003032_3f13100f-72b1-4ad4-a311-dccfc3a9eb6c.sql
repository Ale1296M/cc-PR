ALTER TABLE public.families ADD COLUMN IF NOT EXISTS name text;

CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

GRANT SELECT ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fm admin all" ON public.family_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fm self read" ON public.family_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_in_family(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.family_id = _family_id AND fm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_family_of_recipient(_user_id uuid, _recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_recipients r
    JOIN public.family_members fm ON fm.family_id = r.family_id
    WHERE r.id = _recipient_id AND fm.user_id = _user_id
  );
$$;

DROP TRIGGER IF EXISTS audit_family_members ON public.family_members;
CREATE TRIGGER audit_family_members
  AFTER INSERT OR UPDATE OR DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit();