-- Allow admins to upload to app/ and products/ (and any path); normal users only to their user-id folder
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
