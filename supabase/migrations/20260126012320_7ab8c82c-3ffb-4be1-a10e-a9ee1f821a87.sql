-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('dealer_principal', 'general_manager', 'marketing_manager', 'controller');

-- Create enum for market size
CREATE TYPE public.market_size AS ENUM ('small', 'mid_size', 'large');

-- Create organizations (dealerships) table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    market_size market_size DEFAULT 'mid_size',
    inventory_count INTEGER DEFAULT 0,
    avg_front_gross DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'marketing_manager',
    UNIQUE (user_id, role)
);

-- Create monthly_data table for storing dealer KPIs and spend
CREATE TABLE public.monthly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    month DATE NOT NULL,
    retail_units_sold INTEGER DEFAULT 0,
    inventory_count INTEGER DEFAULT 0,
    avg_front_gross DECIMAL(10,2) DEFAULT 0,
    google_ads_spend DECIMAL(10,2) DEFAULT 0,
    meta_spend DECIMAL(10,2) DEFAULT 0,
    marketplace_spend DECIMAL(10,2) DEFAULT 0,
    seo_spend DECIMAL(10,2) DEFAULT 0,
    other_spend DECIMAL(10,2) DEFAULT 0,
    leads_generated INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, month)
);

-- Create ai_insights table for storing generated insights
CREATE TABLE public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    monthly_data_id UUID REFERENCES public.monthly_data(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id
    FROM public.profiles
    WHERE user_id = _user_id
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
TO authenticated
USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Dealer principals and GMs can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
    id = public.get_user_organization(auth.uid()) AND
    (public.has_role(auth.uid(), 'dealer_principal') OR public.has_role(auth.uid(), 'general_manager'))
);

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their organization"
ON public.user_roles FOR SELECT
TO authenticated
USING (
    user_id IN (
        SELECT p.user_id FROM public.profiles p
        WHERE p.organization_id = public.get_user_organization(auth.uid())
    )
);

CREATE POLICY "Dealer principals can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'dealer_principal'));

-- RLS Policies for monthly_data
CREATE POLICY "Users can view their org monthly data"
ON public.monthly_data FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Non-controllers can insert monthly data"
ON public.monthly_data FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = public.get_user_organization(auth.uid()) AND
    NOT public.has_role(auth.uid(), 'controller')
);

CREATE POLICY "Non-controllers can update monthly data"
ON public.monthly_data FOR UPDATE
TO authenticated
USING (
    organization_id = public.get_user_organization(auth.uid()) AND
    NOT public.has_role(auth.uid(), 'controller')
);

-- RLS Policies for ai_insights
CREATE POLICY "Users can view their org insights"
ON public.ai_insights FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "System can insert insights"
ON public.ai_insights FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_data_updated_at
    BEFORE UPDATE ON public.monthly_data
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();