
-- helper: can a user see a care recipient?
CREATE OR REPLACE FUNCTION public.user_can_view_recipient(_user_id uuid, _recipient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin')
    OR EXISTS (
      SELECT 1 FROM public.care_recipients r
      JOIN public.families f ON f.id = r.family_id
      WHERE r.id = _recipient_id AND f.profile_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.care_shifts s
      JOIN public.caregivers c ON c.id = s.caregiver_id
      WHERE s.care_recipient_id = _recipient_id AND c.profile_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_view_recipient(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_can_view_recipient(uuid,uuid) TO authenticated, service_role;

-- visit logs can point at a care recipient
ALTER TABLE public.visit_logs ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.visit_logs ADD COLUMN IF NOT EXISTS care_recipient_id uuid REFERENCES public.care_recipients(id) ON DELETE CASCADE;
CREATE POLICY "Caregivers manage own recipient visit logs" ON public.visit_logs
  FOR ALL TO authenticated
  USING (caregiver_id = auth.uid() OR (care_recipient_id IS NOT NULL AND public.user_can_view_recipient(auth.uid(), care_recipient_id)))
  WITH CHECK (caregiver_id = auth.uid());

-- rebuild care plan items around care recipients
DROP TABLE IF EXISTS public.task_completions;
DROP TABLE IF EXISTS public.care_plan_items;

CREATE TABLE public.care_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  task_description text NOT NULL,
  category text,
  frequency text NOT NULL DEFAULT 'every_visit' CHECK (frequency IN ('every_visit','weekly','as_needed')),
  active boolean NOT NULL DEFAULT true,
  created_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_items TO authenticated;
GRANT ALL ON public.care_plan_items TO service_role;
ALTER TABLE public.care_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers read care plan items" ON public.care_plan_items
  FOR SELECT TO authenticated USING (public.user_can_view_recipient(auth.uid(), care_recipient_id));
CREATE POLICY "Admins manage care plan items" ON public.care_plan_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER care_plan_items_touch BEFORE UPDATE ON public.care_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.care_plan_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_item_id uuid NOT NULL REFERENCES public.care_plan_items(id) ON DELETE CASCADE,
  visit_log_id uuid NOT NULL REFERENCES public.visit_logs(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (care_plan_item_id, visit_log_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_completions TO authenticated;
GRANT ALL ON public.care_plan_completions TO service_role;
ALTER TABLE public.care_plan_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Caregiver on the visit writes completions" ON public.care_plan_completions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND v.caregiver_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND v.caregiver_id = auth.uid()));
CREATE POLICY "Viewers read completions" ON public.care_plan_completions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.care_plan_items i WHERE i.id = care_plan_item_id
            AND public.user_can_view_recipient(auth.uid(), i.care_recipient_id)));
CREATE TRIGGER care_plan_completions_touch BEFORE UPDATE ON public.care_plan_completions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
