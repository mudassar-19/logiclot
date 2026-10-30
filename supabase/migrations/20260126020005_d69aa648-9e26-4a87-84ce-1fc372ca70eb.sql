
-- Add new columns to organizations for enhanced onboarding
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS crm_dms_name text,
ADD COLUMN IF NOT EXISTS monthly_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_rating numeric,
ADD COLUMN IF NOT EXISTS google_review_count integer,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Create channels table for managing channel templates per org
CREATE TABLE public.channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create channel_data table for monthly entries per channel
CREATE TABLE public.channel_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  month date NOT NULL,
  cost numeric DEFAULT 0,
  leads integer DEFAULT 0,
  appointments integer,
  sold_units integer,
  conversion_rate numeric,
  manual_cps numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(channel_id, month)
);

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_data ENABLE ROW LEVEL SECURITY;

-- Channels policies
CREATE POLICY "Users can view their org channels"
ON public.channels FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert channels for their org"
ON public.channels FOR INSERT
WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update their org channels"
ON public.channels FOR UPDATE
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete their org channels"
ON public.channels FOR DELETE
USING (organization_id = get_user_organization(auth.uid()));

-- Channel data policies
CREATE POLICY "Users can view their org channel data"
ON public.channel_data FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Non-controllers can insert channel data"
ON public.channel_data FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid()) 
  AND NOT has_role(auth.uid(), 'controller'::app_role)
);

CREATE POLICY "Non-controllers can update channel data"
ON public.channel_data FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND NOT has_role(auth.uid(), 'controller'::app_role)
);

CREATE POLICY "Non-controllers can delete channel data"
ON public.channel_data FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND NOT has_role(auth.uid(), 'controller'::app_role)
);

-- Triggers for updated_at
CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_channel_data_updated_at
BEFORE UPDATE ON public.channel_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to seed default channels for new organization
CREATE OR REPLACE FUNCTION public.seed_default_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.channels (organization_id, name, display_order) VALUES
    (NEW.id, 'CarGurus', 1),
    (NEW.id, 'AutoTrader', 2),
    (NEW.id, 'Cars.com', 3),
    (NEW.id, 'Facebook/Instagram (Meta)', 4),
    (NEW.id, 'Google Ads', 5),
    (NEW.id, 'SEO/Website', 6),
    (NEW.id, 'Other', 7);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to seed channels when org is created
CREATE TRIGGER on_organization_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.seed_default_channels();
