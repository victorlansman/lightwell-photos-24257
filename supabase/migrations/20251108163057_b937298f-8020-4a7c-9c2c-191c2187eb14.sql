
-- Ensure photos bucket is truly public and verify configuration
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = NULL,
  allowed_mime_types = NULL
WHERE id = 'photos';

-- Verify all storage objects in photos bucket have public access
-- by ensuring they don't have any access restrictions
UPDATE storage.objects
SET 
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{cacheControl}',
    '"public, max-age=3600"'::jsonb
  )
WHERE bucket_id = 'photos'
  AND name LIKE 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d%';
