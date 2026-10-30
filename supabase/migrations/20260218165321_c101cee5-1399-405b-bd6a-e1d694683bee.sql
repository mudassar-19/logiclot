
-- The INSERT policy must be PERMISSIVE, not RESTRICTIVE
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also make the SELECT policies PERMISSIVE so users can read back the org they just created
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;

CREATE POLICY "Users can view their organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = get_user_organization(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all organizations" ON public.organizations;

CREATE POLICY "Admins can view all organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Dealer principals and GMs can update their organization" ON public.organizations;

CREATE POLICY "Dealer principals and GMs can update their organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING ((id = get_user_organization(auth.uid())) AND (has_role(auth.uid(), 'dealer_principal'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role)));

DROP POLICY IF EXISTS "Admins can update all organizations" ON public.organizations;

CREATE POLICY "Admins can update all organizations"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete organizations" ON public.organizations;

CREATE POLICY "Admins can delete organizations"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
