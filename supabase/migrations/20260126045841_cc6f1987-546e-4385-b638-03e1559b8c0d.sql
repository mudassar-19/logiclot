-- Fix permissive RLS policy on organizations INSERT
-- Restrict to only allow insert when user will be linked to the org
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (
  -- User must not already have an organization
  get_user_organization(auth.uid()) IS NULL
);