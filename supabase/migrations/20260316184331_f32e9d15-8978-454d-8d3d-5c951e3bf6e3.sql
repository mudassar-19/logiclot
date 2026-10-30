
-- Add auction intelligence status to bidding_maps
ALTER TABLE public.bidding_maps 
  ADD COLUMN IF NOT EXISTS intelligence_status text NOT NULL DEFAULT 'not_started';

-- Add outcome tracking to bidding_map_items
ALTER TABLE public.bidding_map_items 
  ADD COLUMN IF NOT EXISTS outcome text DEFAULT NULL;

-- Add current_vehicle_index for live tracking
ALTER TABLE public.bidding_maps 
  ADD COLUMN IF NOT EXISTS current_vehicle_index integer DEFAULT 0;

-- Create sales_history_uploads table
CREATE TABLE public.sales_history_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_history_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org sales history" ON public.sales_history_uploads
  FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert sales history" ON public.sales_history_uploads
  FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete their org sales history" ON public.sales_history_uploads
  FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
