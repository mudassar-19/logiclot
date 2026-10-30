
-- Create spend_entries table
CREATE TABLE public.spend_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  leads integer,
  revenue numeric,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spend_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to organization
CREATE POLICY "Users can view their org spend entries"
  ON public.spend_entries FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Non-controllers can insert spend entries"
  ON public.spend_entries FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()) AND NOT has_role(auth.uid(), 'controller'::app_role));

CREATE POLICY "Non-controllers can update spend entries"
  ON public.spend_entries FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()) AND NOT has_role(auth.uid(), 'controller'::app_role));

CREATE POLICY "Non-controllers can delete spend entries"
  ON public.spend_entries FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()) AND NOT has_role(auth.uid(), 'controller'::app_role));

CREATE POLICY "Admins can view all spend entries"
  ON public.spend_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add onboarding_tour_completed to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_tour_completed boolean DEFAULT false;

-- Index for performance
CREATE INDEX idx_spend_entries_org_date ON public.spend_entries(organization_id, date);

NOTIFY pgrst, 'reload schema';
