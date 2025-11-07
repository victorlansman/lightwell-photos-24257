-- Fix RLS policy for initial collection owner
-- Drop the old policy
DROP POLICY IF EXISTS "Owners can invite members" ON collection_members;

-- Create new policies: one for creating yourself as owner, one for inviting others
CREATE POLICY "Users can add themselves as owner of new collection"
ON collection_members
FOR INSERT
WITH CHECK (
  user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid())
  AND role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM collection_members cm 
    WHERE cm.collection_id = collection_members.collection_id
  )
);

CREATE POLICY "Owners can invite other members"
ON collection_members
FOR INSERT
WITH CHECK (
  user_has_role_in_collection(
    collection_id,
    (SELECT id FROM users WHERE supabase_user_id = auth.uid()),
    'owner'::app_role
  )
  AND user_id != (SELECT id FROM users WHERE supabase_user_id = auth.uid())
);