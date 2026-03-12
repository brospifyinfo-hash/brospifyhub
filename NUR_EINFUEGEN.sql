-- ============================================================
-- NUR DIES in Supabase SQL Editor einfügen und RUN klicken
-- ============================================================

-- 1. Storage-Policy (Fehler "already exists" beheben)
DROP POLICY IF EXISTS "Allow uploads for authenticated users" ON storage.objects;
CREATE POLICY "Allow uploads for authenticated users" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'attachments');

-- 2. Lizenz-Key zum Einloggen (falls Tabelle existiert)
INSERT INTO public.internal_keys (key_value, is_active)
SELECT 'TEST-KEY-2025', true
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'internal_keys')
ON CONFLICT (key_value) DO NOTHING;
