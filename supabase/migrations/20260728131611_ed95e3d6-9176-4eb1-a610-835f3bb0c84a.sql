
CREATE TYPE public.app_role AS ENUM ('admin', 'caregiver', 'client');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'caregiver' THEN 2 WHEN 'client' THEN 3 END
  LIMIT 1
$$;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  date_of_birth date,
  address text,
  notes text,
  primary_contact_name text,
  primary_contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_family_members TO authenticated;
GRANT ALL ON public.client_family_members TO service_role;
ALTER TABLE public.client_family_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  caregiver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.care_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  frequency text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_items TO authenticated;
GRANT ALL ON public.care_plan_items TO service_role;
ALTER TABLE public.care_plan_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.visit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  caregiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  mood text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_logs TO authenticated;
GRANT ALL ON public.visit_logs TO service_role;
ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_log_id uuid NOT NULL REFERENCES public.visit_logs(id) ON DELETE CASCADE,
  care_plan_item_id uuid NOT NULL REFERENCES public.care_plan_items(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visit_log_id, care_plan_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_view_client(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.shifts s WHERE s.client_id = _client_id AND s.caregiver_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.client_family_members f WHERE f.client_id = _client_id AND f.user_id = _user_id);
$$;

CREATE POLICY "profiles read all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "clients admin all" ON public.clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "clients caregiver read" ON public.clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s WHERE s.client_id = clients.id AND s.caregiver_id = auth.uid()));
CREATE POLICY "clients family read" ON public.clients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.client_family_members f WHERE f.client_id = clients.id AND f.user_id = auth.uid()));

CREATE POLICY "cfm admin all" ON public.client_family_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cfm self read" ON public.client_family_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "shifts admin all" ON public.shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "shifts caregiver read" ON public.shifts FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid());
CREATE POLICY "shifts caregiver update" ON public.shifts FOR UPDATE TO authenticated
  USING (caregiver_id = auth.uid());
CREATE POLICY "shifts family read" ON public.shifts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.client_family_members f WHERE f.client_id = shifts.client_id AND f.user_id = auth.uid()));

CREATE POLICY "cpi admin all" ON public.care_plan_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cpi viewer read" ON public.care_plan_items FOR SELECT TO authenticated
  USING (public.user_can_view_client(auth.uid(), client_id));

CREATE POLICY "vl admin all" ON public.visit_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vl caregiver own" ON public.visit_logs FOR ALL TO authenticated
  USING (caregiver_id = auth.uid()) WITH CHECK (caregiver_id = auth.uid());
CREATE POLICY "vl family read" ON public.visit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.client_family_members f WHERE f.client_id = visit_logs.client_id AND f.user_id = auth.uid()));

CREATE POLICY "tc via visit" ON public.task_completions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND (v.caregiver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.visit_logs v WHERE v.id = visit_log_id AND (v.caregiver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "tc family read" ON public.task_completions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.visit_logs v JOIN public.client_family_members f ON f.client_id = v.client_id WHERE v.id = visit_log_id AND f.user_id = auth.uid()));

CREATE POLICY "msg participant read" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "msg sender insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "msg recipient update" ON public.messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'caregiver'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
