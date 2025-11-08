-- Make storage buckets private
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('photos', 'thumbnails');

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view photos in their collections" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view thumbnails in their collections" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;

-- Add RLS policies for photos bucket
CREATE POLICY "Users can view photos in their collections"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM photos p
    JOIN collection_members cm ON cm.collection_id = p.collection_id
    JOIN users u ON u.id = cm.user_id
    WHERE p.path = storage.objects.name
    AND u.supabase_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM collection_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.role IN ('owner', 'admin')
    AND u.supabase_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM photos p
    JOIN collection_members cm ON cm.collection_id = p.collection_id
    JOIN users u ON u.id = cm.user_id
    WHERE p.path = storage.objects.name
    AND cm.role IN ('owner', 'admin')
    AND u.supabase_user_id = auth.uid()
  )
);

-- Add RLS policies for thumbnails bucket
CREATE POLICY "Users can view thumbnails in their collections"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'thumbnails' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails' AND
  auth.uid() IS NOT NULL
);