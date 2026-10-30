-- Phase 1: Fix Profiles Table RLS - Allow users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Phase 2: Add Organizations INSERT Policy for onboarding
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Phase 3: Add DELETE policy for profiles (only owner)
CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Phase 4: Add DELETE policy for monthly_data (dealer principals only)
CREATE POLICY "Dealer principals can delete monthly data"
ON public.monthly_data FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'dealer_principal')
);

-- Phase 5: Add UPDATE and DELETE policies for ai_insights
CREATE POLICY "Dealer principals can update insights"
ON public.ai_insights FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'dealer_principal')
);

CREATE POLICY "Dealer principals can delete insights"
ON public.ai_insights FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND has_role(auth.uid(), 'dealer_principal')
);

-- Phase 6: Ensure trigger exists for auto-creating profiles
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();