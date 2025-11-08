-- Fix storage policies to allow public access to photos bucket
-- Drop existing policies
DROP POLICY IF EXISTS "Public access to photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;

-- Create new policies that work with or without owner_id
CREATE POLICY "Anyone can view photos in photos bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Authenticated users can upload to photos bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update photos bucket"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete from photos bucket"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);