-- Phase 3: family policy swap to the family_members model.
-- Admin / caregiver / self policies are untouched. No deleted_at clauses existed on these policies.

DROP POLICY "cr family read" ON public.care_recipients;
CREATE POLICY "cr family read" ON public.care_recipients FOR SELECT TO authenticated
  USING (public.user_in_family(auth.uid(), family_id));

DROP POLICY "care_shifts family read" ON public.care_shifts;
CREATE POLICY "care_shifts family read" ON public.care_shifts FOR SELECT TO authenticated
  USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id));

DROP POLICY "caregivers family read assigned" ON public.caregivers;
CREATE POLICY "caregivers family read assigned" ON public.caregivers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_shifts s
    JOIN public.care_recipients r ON r.id = s.care_recipient_id
    WHERE s.caregiver_id = caregivers.id
      AND public.user_in_family(auth.uid(), r.family_id)
  ));

DROP POLICY "ec family read" ON public.emergency_contacts;
CREATE POLICY "ec family read" ON public.emergency_contacts FOR SELECT TO authenticated
  USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id));

DROP POLICY "ir family read" ON public.incident_reports;
CREATE POLICY "ir family read" ON public.incident_reports FOR SELECT TO authenticated
  USING (public.user_in_family_of_recipient(auth.uid(), care_recipient_id));

DROP POLICY "ir family create" ON public.incident_reports;
CREATE POLICY "ir family create" ON public.incident_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid() AND public.user_in_family_of_recipient(auth.uid(), care_recipient_id));

DROP POLICY "vl family read" ON public.visit_logs;
CREATE POLICY "vl family read" ON public.visit_logs FOR SELECT TO authenticated
  USING (care_recipient_id IS NOT NULL AND public.user_in_family_of_recipient(auth.uid(), care_recipient_id));

DROP POLICY "we family read" ON public.wellbeing_entries;
CREATE POLICY "we family read" ON public.wellbeing_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.visit_logs v
    WHERE v.id = wellbeing_entries.visit_log_id
      AND v.care_recipient_id IS NOT NULL
      AND public.user_in_family_of_recipient(auth.uid(), v.care_recipient_id)
  ));

CREATE OR REPLACE FUNCTION public.can_access_family_thread(_user_id uuid, _family_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.user_in_family(_user_id, _family_id);
$$;