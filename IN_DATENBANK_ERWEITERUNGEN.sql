-- =============================================
-- BROSPIFY HUB – ERWEITERUNGEN (nach IN_DATENBANK_EINFUEGEN)
-- =============================================
-- Einmal im Supabase SQL Editor ausführen.
-- Enthält: Storage-Policy für Admin-Uploads (app/, products/), Produkt-Spalten video_url/pdf_url.
-- =============================================

-- 1. Storage: Admins dürfen in app/ und products/ hochladen
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

-- 2. Produkte: optionale Video- und PDF-URL
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN public.products.video_url IS 'Optionale Video-URL (z.B. Vorschau, Erklärung)';
COMMENT ON COLUMN public.products.pdf_url IS 'Optionale PDF-URL (z.B. Anleitung, Broschüre)';
