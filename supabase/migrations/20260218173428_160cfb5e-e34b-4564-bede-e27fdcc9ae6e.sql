
-- Fix profiles policies to be PERMISSIVE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Dealer principals can view org profiles" ON public.profiles;
CREATE POLICY "Dealer principals can view org profiles" ON public.profiles FOR SELECT TO authenticated USING ((organization_id = get_user_organization(auth.uid())) AND has_role(auth.uid(), 'dealer_principal'::app_role));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles policies to be PERMISSIVE
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own role during onboarding" ON public.user_roles;
CREATE POLICY "Users can insert own role during onboarding" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view roles in their organization" ON public.user_roles;
CREATE POLICY "Users can view roles in their organization" ON public.user_roles FOR SELECT TO authenticated USING (user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

DROP POLICY IF EXISTS "Dealer principals can assign roles to org members" ON public.user_roles;
CREATE POLICY "Dealer principals can assign roles to org members" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'dealer_principal'::app_role) AND user_id <> auth.uid() AND user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

DROP POLICY IF EXISTS "Dealer principals can update org member roles" ON public.user_roles;
CREATE POLICY "Dealer principals can update org member roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'dealer_principal'::app_role) AND user_id <> auth.uid() AND user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

DROP POLICY IF EXISTS "Dealer principals can remove org member roles" ON public.user_roles;
CREATE POLICY "Dealer principals can remove org member roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'dealer_principal'::app_role) AND user_id <> auth.uid() AND user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
