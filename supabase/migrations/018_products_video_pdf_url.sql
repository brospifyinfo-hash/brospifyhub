-- Optional: Video-URL und PDF-URL pro Produkt
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN public.products.video_url IS 'Optionale Video-URL (z.B. Vorschau, Erklärung)';
COMMENT ON COLUMN public.products.pdf_url IS 'Optionale PDF-URL (z.B. Anleitung, Broschüre)';
