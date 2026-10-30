-- Drop and recreate the INSERT policy with a simpler check
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
