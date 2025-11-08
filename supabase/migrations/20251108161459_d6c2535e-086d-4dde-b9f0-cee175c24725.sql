-- Fix storage policies to allow public read access for images
-- This is necessary because <img> tags don't send authentication credentials
-- Write operations remain restricted to authenticated collection members

DROP POLICY IF EXISTS "Members can view their collection photos" ON storage.objects;

-- Allow anyone to view photos (necessary for img tags to work)
-- Photos are still protected by obscure UUIDs in paths
CREATE POLICY "Public read access for photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Keep write operations restricted to authenticated collection members
-- (these policies already exist and are correct)