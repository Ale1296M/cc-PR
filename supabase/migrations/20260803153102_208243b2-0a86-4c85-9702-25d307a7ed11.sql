-- SUBSCRIPTION TIERS
CREATE TABLE public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  hours_per_week integer NOT NULL,
  monthly_price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_tiers TO authenticated;
GRANT ALL ON public.subscription_tiers TO service_role;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers read" ON public.subscription_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "tiers admin all" ON public.subscription_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER subscription_tiers_touch BEFORE UPDATE ON public.subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.subscription_tiers (name, hours_per_week, monthly_price) VALUES
  ('Ligero', 8, 480.00),
  ('Moderado', 20, 1150.00),
  ('Extendido', 40, 2200.00);

-- FAMILIES
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_tier_id uuid REFERENCES public.subscription_tiers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX families_profile_id_idx ON public.families(profile_id);
GRANT SELECT ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "families self read" ON public.families FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
CREATE POLICY "families admin all" ON public.families FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER families_touch BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: is this user the paying member of the family?
CREATE OR REPLACE FUNCTION public.user_owns_family(_user_id uuid, _family_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.families f WHERE f.id = _family_id AND f.profile_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.user_owns_family(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_family(uuid, uuid) TO authenticated, service_role;

-- CARE RECIPIENTS
CREATE TABLE public.care_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  address_line text,
  city text,
  municipality text,
  zip_code text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_recipients_family_id_idx ON public.care_recipients(family_id);
GRANT SELECT ON public.care_recipients TO authenticated;
GRANT ALL ON public.care_recipients TO service_role;
ALTER TABLE public.care_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr family read" ON public.care_recipients FOR SELECT TO authenticated
  USING (public.user_owns_family(auth.uid(), family_id));
CREATE POLICY "cr admin all" ON public.care_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER care_recipients_touch BEFORE UPDATE ON public.care_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CAREGIVERS
CREATE TABLE public.caregivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  background_check_status text NOT NULL DEFAULT 'pending'
    CHECK (background_check_status IN ('pending','in_progress','cleared','failed','expired')),
  background_check_date date,
  bio text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.caregivers TO authenticated;
GRANT ALL ON public.caregivers TO service_role;
ALTER TABLE public.caregivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caregivers self read" ON public.caregivers FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
CREATE POLICY "caregivers self update" ON public.caregivers FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "caregivers admin all" ON public.caregivers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER caregivers_touch BEFORE UPDATE ON public.caregivers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- caregivers cannot self-modify vetting fields
CREATE OR REPLACE FUNCTION public.protect_caregiver_vetting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.background_check_status := OLD.background_check_status;
    NEW.background_check_date := OLD.background_check_date;
    NEW.active := OLD.active;
    NEW.profile_id := OLD.profile_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_caregiver_vetting() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER caregivers_protect_vetting BEFORE UPDATE ON public.caregivers
  FOR EACH ROW EXECUTE FUNCTION public.protect_caregiver_vetting();