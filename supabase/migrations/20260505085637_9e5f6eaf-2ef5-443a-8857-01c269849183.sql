
CREATE TABLE public.service_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reported_defect TEXT,
  service_performed TEXT,
  parts_replaced TEXT,
  technician TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  value NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own service calls" ON public.service_calls
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own service calls" ON public.service_calls
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own service calls" ON public.service_calls
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own service calls" ON public.service_calls
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER service_calls_updated_at
  BEFORE UPDATE ON public.service_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_service_calls_user_date ON public.service_calls(user_id, service_date DESC);
