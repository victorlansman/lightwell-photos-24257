-- Drop the old overly-permissive public policy
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Ensure CORS headers are properly set on storage buckets
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[],
    file_size_limit = 52428800 -- 50MB
WHERE id IN ('photos', 'thumbnails');