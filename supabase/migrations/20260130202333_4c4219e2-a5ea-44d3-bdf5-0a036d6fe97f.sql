-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Dealer principals can manage roles" ON public.user_roles;

-- Keep the existing SELECT policy for viewing roles in organization (it's good)
-- Policy "Users can view roles in their organization" already exists and is properly scoped

-- Create granular policies for dealer principals to manage OTHER users' roles within their org

-- INSERT: Dealer principals can assign roles to OTHER users in their organization
CREATE POLICY "Dealer principals can assign roles to org members"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'dealer_principal') AND 
  user_id != auth.uid() AND
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.organization_id = get_user_organization(auth.uid())
  )
);

-- UPDATE: Dealer principals can update roles for OTHER users in their organization
CREATE POLICY "Dealer principals can update org member roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'dealer_principal') AND 
  user_id != auth.uid() AND
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.organization_id = get_user_organization(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'dealer_principal') AND 
  user_id != auth.uid() AND
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.organization_id = get_user_organization(auth.uid())
  )
);

-- DELETE: Dealer principals can remove role assignments for OTHER users in their organization
CREATE POLICY "Dealer principals can remove org member roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'dealer_principal') AND 
  user_id != auth.uid() AND
  user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.organization_id = get_user_organization(auth.uid())
  )
);