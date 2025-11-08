-- Drop the complex policy and replace with a simpler one using existing function
DROP POLICY IF EXISTS "Users can view photos in their collections" ON storage.objects;

CREATE POLICY "Users can view photos in their collections"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' AND
  user_is_member_of_collection(
    (split_part(name, '/', 1))::uuid,
    (SELECT id FROM users WHERE supabase_user_id = auth.uid())
  )
);