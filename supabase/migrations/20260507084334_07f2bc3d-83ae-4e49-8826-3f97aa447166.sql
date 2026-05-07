
-- 1. Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'technician');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. has_role function (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager')) $$;

-- 4. Auto-assign role on signup: first user => admin, others => technician
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    _role := 'admin';
  ELSE
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'technician');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill: existing users get profile + admin (first one) / technician
INSERT INTO public.profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email) FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ORDER BY created_at ASC LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. Add assigned_to columns
ALTER TABLE public.service_calls ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_service_calls_assigned_to ON public.service_calls(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reminders_assigned_to ON public.reminders(assigned_to);

-- 7. RLS policies for user_roles
CREATE POLICY "view own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. RLS for profiles
CREATE POLICY "staff view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR auth.uid() = id);
CREATE POLICY "user update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);
CREATE POLICY "admin delete profile" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Replace RLS on service_calls
DROP POLICY IF EXISTS "Users can view own service calls" ON public.service_calls;
DROP POLICY IF EXISTS "Users can insert own service calls" ON public.service_calls;
DROP POLICY IF EXISTS "Users can update own service calls" ON public.service_calls;
DROP POLICY IF EXISTS "Users can delete own service calls" ON public.service_calls;

CREATE POLICY "view service_calls" ON public.service_calls FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "staff insert service_calls" ON public.service_calls FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "update service_calls" ON public.service_calls FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "staff delete service_calls" ON public.service_calls FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 10. Replace RLS on clients
DROP POLICY IF EXISTS "select own clients" ON public.clients;
DROP POLICY IF EXISTS "insert own clients" ON public.clients;
DROP POLICY IF EXISTS "update own clients" ON public.clients;
DROP POLICY IF EXISTS "delete own clients" ON public.clients;

CREATE POLICY "view clients" ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.service_calls sc WHERE sc.client_id = clients.id AND sc.assigned_to = auth.uid())
  );
CREATE POLICY "staff insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "staff update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 11. Replace RLS on parts (technicians read-only)
DROP POLICY IF EXISTS "select own parts" ON public.parts;
DROP POLICY IF EXISTS "insert own parts" ON public.parts;
DROP POLICY IF EXISTS "update own parts" ON public.parts;
DROP POLICY IF EXISTS "delete own parts" ON public.parts;

CREATE POLICY "view parts" ON public.parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert parts" ON public.parts FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "staff update parts" ON public.parts FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete parts" ON public.parts FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 12. Replace RLS on reminders
DROP POLICY IF EXISTS "select own reminders" ON public.reminders;
DROP POLICY IF EXISTS "insert own reminders" ON public.reminders;
DROP POLICY IF EXISTS "update own reminders" ON public.reminders;
DROP POLICY IF EXISTS "delete own reminders" ON public.reminders;

CREATE POLICY "view reminders" ON public.reminders FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_calls sc WHERE sc.id = reminders.service_call_id AND sc.assigned_to = auth.uid()));
CREATE POLICY "staff insert reminders" ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "update reminders" ON public.reminders FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "staff delete reminders" ON public.reminders FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
