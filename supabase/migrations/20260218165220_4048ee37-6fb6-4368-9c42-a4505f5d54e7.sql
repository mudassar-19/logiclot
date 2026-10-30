
-- Re-drop and recreate to ensure clean state
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure the seed_default_channels trigger exists and works
-- Check if there's a conflicting trigger
DROP TRIGGER IF EXISTS seed_default_channels ON public.organizations;
CREATE TRIGGER seed_default_channels
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_channels();
