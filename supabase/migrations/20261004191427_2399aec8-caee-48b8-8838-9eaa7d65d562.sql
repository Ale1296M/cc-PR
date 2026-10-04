-- 1. Close visit_logs hole: the old FOR ALL policy let family members and other caregivers update/delete logs.
DROP POLICY IF EXISTS "Caregivers manage own recipient visit logs" ON public.visit_logs;

-- 2. Security events (403 audit trail)
CREATE TABLE public.security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  event text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security events admin read" ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX security_events_created_idx ON public.security_events (created_at DESC);
CREATE INDEX security_events_actor_idx ON public.security_events (actor_id, created_at DESC);

-- Logs a denied access attempt for the calling user. Callers cannot spoof actor_id.
CREATE OR REPLACE FUNCTION public.log_security_event(_event text, _resource_type text, _resource_id text, _details jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_events (actor_id, event, resource_type, resource_id, details)
  VALUES (auth.uid(), left(_event, 64), left(_resource_type, 64), left(_resource_id, 128), _details);
END $$;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, jsonb) TO authenticated;

-- Returns the caller's access level to a recipient ('admin' | 'family' | 'caregiver' | null) and logs denials.
CREATE OR REPLACE FUNCTION public.recipient_access_level(_recipient_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  IF public.has_role(uid, 'admin') THEN RETURN 'admin'; END IF;
  IF public.user_in_family_of_recipient(uid, _recipient_id) THEN RETURN 'family'; END IF;
  IF public.caregiver_has_shift_with_recipient(uid, _recipient_id) THEN RETURN 'caregiver'; END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.recipient_access_level(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recipient_access_level(uuid) TO authenticated;

-- 3. Indexes for care-log lookups and RLS helper joins
CREATE INDEX IF NOT EXISTS idx_visit_logs_recipient_clock_in ON public.visit_logs (care_recipient_id, clock_in DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_visit_logs_caregiver_clock_in ON public.visit_logs (caregiver_id, clock_in DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_visit_logs_exceptions ON public.visit_logs (clock_in DESC) WHERE evv_exception IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_visit_logs_shift ON public.visit_logs (shift_id);
CREATE INDEX IF NOT EXISTS idx_care_shifts_recipient_date ON public.care_shifts (care_recipient_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_care_shifts_caregiver_date ON public.care_shifts (caregiver_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_care_plan_items_recipient ON public.care_plan_items (care_recipient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_care_plan_completions_visit ON public.care_plan_completions (visit_log_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_recipient_date ON public.incident_reports (care_recipient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports (status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_recipient ON public.emergency_contacts (care_recipient_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_created ON public.audit_log (table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_caregiver_messages_thread ON public.caregiver_messages (caregiver_profile_id, created_at);