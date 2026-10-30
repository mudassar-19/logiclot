-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Re-confirm the INSERT policy exists and is correct
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" 
  ON public.organizations FOR INSERT TO authenticated 
  WITH CHECK (true);
