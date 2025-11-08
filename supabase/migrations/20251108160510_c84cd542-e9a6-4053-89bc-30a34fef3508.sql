-- Ensure photos bucket is public for CORS but protected by RLS
UPDATE storage.buckets 
SET public = true 
WHERE id = 'photos';

-- Drop all existing policies on storage.objects for photos bucket
DROP POLICY IF EXISTS "Public can view all photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Members can update photos in their collections" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete photos in their collections" ON storage.objects;

-- Create policy for authenticated users to view photos in their collections
-- Photos are stored as: collection_id/filename.jpg
CREATE POLICY "Members can view their collection photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' 
  AND (
    SELECT user_is_member_of_collection(
      split_part(name, '/', 1)::uuid,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  )
);

-- Policy for uploading photos (authenticated users who are collection members)
CREATE POLICY "Members can upload to their collections"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (
    SELECT user_is_member_of_collection(
      split_part(name, '/', 1)::uuid,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  )
);

-- Policy for updating photos
CREATE POLICY "Members can update their collection photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    SELECT user_is_member_of_collection(
      split_part(name, '/', 1)::uuid,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  )
);

-- Policy for deleting photos
CREATE POLICY "Members can delete their collection photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (
    SELECT user_is_member_of_collection(
      split_part(name, '/', 1)::uuid,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  )
);