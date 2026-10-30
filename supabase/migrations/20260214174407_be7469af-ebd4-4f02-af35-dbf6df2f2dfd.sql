
-- Fix: All RLS policies on organizations are RESTRICTIVE, meaning no PERMISSIVE policy exists
-- and therefore ALL access is denied. We need to make the key policies PERMISSIVE.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Dealer principals and GMs can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can delete organizations" ON public.organizations;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (get_user_organization(auth.uid()) IS NULL);

CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = get_user_organization(auth.uid()));

CREATE POLICY "Dealer principals and GMs can update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (id = get_user_organization(auth.uid()) AND (has_role(auth.uid(), 'dealer_principal') OR has_role(auth.uid(), 'general_manager')));

CREATE POLICY "Admins can view all organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete organizations"
  ON public.organizations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Also fix profiles policies (same issue - all RESTRICTIVE)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Dealer principals can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Dealer principals can view org profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ((organization_id = get_user_organization(auth.uid())) AND has_role(auth.uid(), 'dealer_principal'));

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix user_roles policies (same issue)
DROP POLICY IF EXISTS "Users can view roles in their organization" ON public.user_roles;
DROP POLICY IF EXISTS "Dealer principals can assign roles to org members" ON public.user_roles;
DROP POLICY IF EXISTS "Dealer principals can update org member roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dealer principals can remove org member roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- Users can view their own role (needed for onboarding)
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own role during onboarding (when they have no role yet)
CREATE POLICY "Users can insert own role during onboarding"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view roles in their organization"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Dealer principals can assign roles to org members"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'dealer_principal') AND user_id <> auth.uid() AND user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Dealer principals can update org member roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'dealer_principal') AND user_id <> auth.uid() AND user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Dealer principals can remove org member roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'dealer_principal') AND user_id <> auth.uid() AND user_id IN (SELECT p.user_id FROM profiles p WHERE p.organization_id = get_user_organization(auth.uid())));

CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
