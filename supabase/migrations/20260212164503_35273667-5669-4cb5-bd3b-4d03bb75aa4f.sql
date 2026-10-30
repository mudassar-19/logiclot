
-- Drop the existing RESTRICTIVE insert policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Recreate as PERMISSIVE so authenticated users can actually insert
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (get_user_organization(auth.uid()) IS NULL);
