-- Clean up ALL storage.objects policies and create a clean, simple set
-- Drop all existing policies on storage.objects
DROP POLICY IF EXISTS "Anyone can view photos in photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload to their collections" ON storage.objects;
DROP POLICY IF EXISTS "Members can update their collection photos" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete their collection photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner/admin can upload photos to their collections" ON storage.objects;
DROP POLICY IF EXISTS "Owner/admin can delete photos from their collections" ON storage.objects;

-- Create simple, clear policies for photos bucket
-- Allow public SELECT (required for <img> tags to work)
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Allow authenticated users who are collection members to upload
CREATE POLICY "Collection members can upload photos"
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

-- Allow authenticated users who are collection members to update
CREATE POLICY "Collection members can update photos"
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

-- Allow authenticated users who are collection members to delete
CREATE POLICY "Collection members can delete photos"
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