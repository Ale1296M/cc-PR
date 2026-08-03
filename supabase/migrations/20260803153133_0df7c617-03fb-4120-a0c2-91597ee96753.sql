DROP POLICY "cr family read" ON public.care_recipients;
CREATE POLICY "cr family read" ON public.care_recipients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = care_recipients.family_id AND f.profile_id = auth.uid()
  ));
DROP FUNCTION IF EXISTS public.user_owns_family(uuid, uuid);