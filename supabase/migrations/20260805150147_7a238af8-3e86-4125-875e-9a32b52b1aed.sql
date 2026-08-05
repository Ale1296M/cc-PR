CREATE OR REPLACE FUNCTION public.profiles_share_care_circle(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- family owner <-> caregiver assigned to one of that family's recipients
    EXISTS (
      SELECT 1
      FROM public.families f
      JOIN public.care_recipients r ON r.family_id = f.id
      JOIN public.care_shifts s ON s.care_recipient_id = r.id
      JOIN public.caregivers c ON c.id = s.caregiver_id
      WHERE (f.profile_id = _viewer AND c.profile_id = _target)
         OR (f.profile_id = _target AND c.profile_id = _viewer)
    )
    -- legacy clients model: family member <-> caregiver on that client's shifts
    OR EXISTS (
      SELECT 1
      FROM public.client_family_members fm
      JOIN public.shifts s ON s.client_id = fm.client_id
      WHERE (fm.user_id = _viewer AND s.caregiver_id = _target)
         OR (fm.user_id = _target AND s.caregiver_id = _viewer)
    )
    -- family members of the same client
    OR EXISTS (
      SELECT 1
      FROM public.client_family_members a
      JOIN public.client_family_members b ON b.client_id = a.client_id
      WHERE a.user_id = _viewer AND b.user_id = _target
    );
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_share_care_circle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_share_care_circle(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles read all" ON public.profiles;

CREATE POLICY "Users read own, admins all, care circle only"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.profiles_share_care_circle(auth.uid(), id)
);