CREATE TABLE public.care_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  caregiver_id uuid REFERENCES public.caregivers(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time NOT NULL,
  scheduled_end_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX care_shifts_recipient_date_idx ON public.care_shifts(care_recipient_id, scheduled_date);
CREATE INDEX care_shifts_caregiver_date_idx ON public.care_shifts(caregiver_id, scheduled_date);

GRANT SELECT, UPDATE ON public.care_shifts TO authenticated;
GRANT ALL ON public.care_shifts TO service_role;

ALTER TABLE public.care_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_shifts admin all" ON public.care_shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "care_shifts caregiver read" ON public.care_shifts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.caregivers c
    WHERE c.id = care_shifts.caregiver_id AND c.profile_id = auth.uid()
  ));

CREATE POLICY "care_shifts caregiver update" ON public.care_shifts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.caregivers c
    WHERE c.id = care_shifts.caregiver_id AND c.profile_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.caregivers c
    WHERE c.id = care_shifts.caregiver_id AND c.profile_id = auth.uid()
  ));

CREATE POLICY "care_shifts family read" ON public.care_shifts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_recipients r
    JOIN public.families f ON f.id = r.family_id
    WHERE r.id = care_shifts.care_recipient_id AND f.profile_id = auth.uid()
  ));

CREATE TRIGGER care_shifts_touch BEFORE UPDATE ON public.care_shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- caregivers must be visible to admins for assignment; families need caregiver
-- first name + photo, which lives in profiles (already readable to signed-in users).
CREATE POLICY "caregivers family read assigned" ON public.caregivers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_shifts s
    JOIN public.care_recipients r ON r.id = s.care_recipient_id
    JOIN public.families f ON f.id = r.family_id
    WHERE s.caregiver_id = caregivers.id AND f.profile_id = auth.uid()
  ));