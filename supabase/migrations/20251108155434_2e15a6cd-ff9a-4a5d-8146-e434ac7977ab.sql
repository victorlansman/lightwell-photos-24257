-- Clean up duplicate and conflicting storage policies for photos bucket
DROP POLICY IF EXISTS "Public photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Members can view photos in their collections" ON storage.objects;

-- Keep only the simple public access policy for photos bucket
-- This allows anyone (authenticated or not) to view photos
CREATE POLICY "Public can view all photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');