-- Allow admins to read ALL profiles (cross-org)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read ALL organizations
CREATE POLICY "Admins can view all organizations"
ON public.organizations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update ANY organization
CREATE POLICY "Admins can update all organizations"
ON public.organizations
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete ANY organization
CREATE POLICY "Admins can delete organizations"
ON public.organizations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read ALL user_roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage ALL user_roles (insert/update/delete)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read ALL channel_data
CREATE POLICY "Admins can view all channel data"
ON public.channel_data
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read ALL channels
CREATE POLICY "Admins can view all channels"
ON public.channels
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read ALL monthly_data
CREATE POLICY "Admins can view all monthly data"
ON public.monthly_data
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read ALL ai_insights
CREATE POLICY "Admins can view all ai insights"
ON public.ai_insights
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));
