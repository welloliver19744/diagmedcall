
-- Service call extra fields
ALTER TABLE public.service_calls
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'litotripsia',
  ADD COLUMN IF NOT EXISTS report_number text,
  ADD COLUMN IF NOT EXISTS equipment_type text,
  ADD COLUMN IF NOT EXISTS equipment_serial text,
  ADD COLUMN IF NOT EXISTS responsible_employee text,
  ADD COLUMN IF NOT EXISTS installed_at date,
  ADD COLUMN IF NOT EXISTS in_warranty boolean,
  ADD COLUMN IF NOT EXISTS in_contract boolean,
  ADD COLUMN IF NOT EXISTS transformer_serial text,
  ADD COLUMN IF NOT EXISTS counter_odometer text,
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS working_before boolean,
  ADD COLUMN IF NOT EXISTS verified_tested boolean,
  ADD COLUMN IF NOT EXISTS working_after boolean,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS parts_used jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parts_requested jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parts_priority text;

-- Allow only the two valid models
DO $$ BEGIN
  ALTER TABLE public.service_calls
    ADD CONSTRAINT service_calls_report_type_chk
    CHECK (report_type IN ('litotripsia','laser'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Technician signature
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_url text;

-- Storage bucket for signatures (public, used inside PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures','signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "signatures public read" ON storage.objects;
CREATE POLICY "signatures public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "signatures auth upload" ON storage.objects;
CREATE POLICY "signatures auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures');

DROP POLICY IF EXISTS "signatures auth update own" ON storage.objects;
CREATE POLICY "signatures auth update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "signatures auth delete own" ON storage.objects;
CREATE POLICY "signatures auth delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);
