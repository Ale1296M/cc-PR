CREATE TYPE public.medicine_taken AS ENUM ('yes','no','partial');
CREATE TYPE public.appetite_level AS ENUM ('good','fair','poor');

CREATE TABLE public.wellbeing_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_log_id uuid NOT NULL UNIQUE REFERENCES public.visit_logs(id) ON DELETE CASCADE,
  medicine_taken public.medicine_taken,
  medicine_notes text,
  food_meals_offered text,
  food_appetite public.appetite_level,
  food_notes text,
  movement_notes text,
  movement_assisted boolean,
  hygiene_bathing_completed boolean,
  hygiene_grooming_completed boolean,
  hygiene_notes text,
  mood_scale smallint CHECK (mood_scale BETWEEN 1 AND 5),
  mood_tags text[] NOT NULL DEFAULT '{}',
  mood_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellbeing_entries TO authenticated;
GRANT ALL ON public.wellbeing_entries TO service_role;

ALTER TABLE public.wellbeing_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "we admin all" ON public.wellbeing_entries FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "we caregiver insert own visit" ON public.wellbeing_entries FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND v.caregiver_id = auth.uid()));

CREATE POLICY "we caregiver read own visit" ON public.wellbeing_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND v.caregiver_id = auth.uid()));

CREATE POLICY "we caregiver update own visit" ON public.wellbeing_entries FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND v.caregiver_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND v.caregiver_id = auth.uid()));

CREATE POLICY "we family read" ON public.wellbeing_entries FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.visit_logs v
  JOIN public.client_family_members f ON f.client_id = v.client_id
  WHERE v.id = visit_log_id AND f.user_id = auth.uid()
));

CREATE TRIGGER wellbeing_entries_touch BEFORE UPDATE ON public.wellbeing_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX wellbeing_entries_visit_log_idx ON public.wellbeing_entries(visit_log_id);