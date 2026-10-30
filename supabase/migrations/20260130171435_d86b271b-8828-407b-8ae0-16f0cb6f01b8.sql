-- Fix: Restrict profile visibility to prevent unauthorized access to contact information
-- Users can only view their own profile, dealer principals can view all profiles in their org

-- Drop the overly permissive organization-wide SELECT policy
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create a new policy allowing only dealer principals to view other profiles in their organization
CREATE POLICY "Dealer principals can view org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR (
    organization_id = get_user_organization(auth.uid()) 
    AND has_role(auth.uid(), 'dealer_principal'::app_role)
  )
);