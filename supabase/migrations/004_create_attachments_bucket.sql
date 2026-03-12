-- Create attachments storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Allow uploads for authenticated users" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to attachments  
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'attachments');