
-- Add missing columns to dealer_preferences
ALTER TABLE public.dealer_preferences 
  ADD COLUMN IF NOT EXISTS target_profit numeric DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS max_recon_cost numeric DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS allow_exotics boolean DEFAULT false;

-- Create auction_run_lists table
CREATE TABLE IF NOT EXISTS public.auction_run_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  auction_source text,
  auction_name text,
  auction_date date,
  status text NOT NULL DEFAULT 'uploaded',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_run_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org auction run lists" ON public.auction_run_lists
  FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert auction run lists" ON public.auction_run_lists
  FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org auction run lists" ON public.auction_run_lists
  FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can delete their org auction run lists" ON public.auction_run_lists
  FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Create auction_vehicles table
CREATE TABLE IF NOT EXISTS public.auction_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_list_id uuid NOT NULL REFERENCES public.auction_run_lists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  mileage integer,
  lane text,
  run_order integer,
  cr_score numeric,
  has_cr boolean DEFAULT true,
  seller_type text,
  title_status text DEFAULT 'clean',
  condition_notes text,
  estimated_retail_value numeric,
  estimated_recon_cost numeric,
  estimated_profit numeric,
  recommended_max_bid numeric,
  ai_recommendation text DEFAULT 'review',
  risk_flags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org auction vehicles" ON public.auction_vehicles
  FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert auction vehicles" ON public.auction_vehicles
  FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org auction vehicles" ON public.auction_vehicles
  FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can delete their org auction vehicles" ON public.auction_vehicles
  FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Create buy_lists table
CREATE TABLE IF NOT EXISTS public.buy_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_list_id uuid NOT NULL REFERENCES public.auction_run_lists(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Buy List',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buy_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org buy lists" ON public.buy_lists
  FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert buy lists" ON public.buy_lists
  FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org buy lists" ON public.buy_lists
  FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can delete their org buy lists" ON public.buy_lists
  FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Create buy_list_items table
CREATE TABLE IF NOT EXISTS public.buy_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_list_id uuid NOT NULL REFERENCES public.buy_lists(id) ON DELETE CASCADE,
  auction_vehicle_id uuid NOT NULL REFERENCES public.auction_vehicles(id) ON DELETE CASCADE,
  selected_for_bidding_map boolean DEFAULT false,
  dealer_notes text,
  custom_max_bid numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buy_list_id, auction_vehicle_id)
);

ALTER TABLE public.buy_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view buy list items via buy list org" ON public.buy_list_items
  FOR SELECT TO authenticated USING (
    buy_list_id IN (SELECT id FROM public.buy_lists WHERE organization_id = get_user_organization(auth.uid()))
  );
CREATE POLICY "Users can insert buy list items" ON public.buy_list_items
  FOR INSERT TO authenticated WITH CHECK (
    buy_list_id IN (SELECT id FROM public.buy_lists WHERE organization_id = get_user_organization(auth.uid()))
  );
CREATE POLICY "Users can update buy list items" ON public.buy_list_items
  FOR UPDATE TO authenticated USING (
    buy_list_id IN (SELECT id FROM public.buy_lists WHERE organization_id = get_user_organization(auth.uid()))
  );
CREATE POLICY "Users can delete buy list items" ON public.buy_list_items
  FOR DELETE TO authenticated USING (
    buy_list_id IN (SELECT id FROM public.buy_lists WHERE organization_id = get_user_organization(auth.uid()))
  );

-- Create bidding_maps table
CREATE TABLE IF NOT EXISTS public.bidding_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  buy_list_id uuid NOT NULL REFERENCES public.buy_lists(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Bidding Map',
  mode text NOT NULL DEFAULT 'in_lane',
  auction_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bidding_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org bidding maps" ON public.bidding_maps
  FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert bidding maps" ON public.bidding_maps
  FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org bidding maps" ON public.bidding_maps
  FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can delete their org bidding maps" ON public.bidding_maps
  FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Create bidding_map_items table
CREATE TABLE IF NOT EXISTS public.bidding_map_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bidding_map_id uuid NOT NULL REFERENCES public.bidding_maps(id) ON DELETE CASCADE,
  auction_vehicle_id uuid NOT NULL REFERENCES public.auction_vehicles(id) ON DELETE CASCADE,
  lane text,
  run_order integer,
  recommended_bid numeric,
  estimated_time_until_run text,
  bidding_notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bidding_map_id, auction_vehicle_id)
);

ALTER TABLE public.bidding_map_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bidding map items via map org" ON public.bidding_map_items
  FOR SELECT TO authenticated USING (
    bidding_map_id IN (SELECT id FROM public.bidding_maps WHERE organization_id = get_user_organization(auth.uid()))
  );
CREATE POLICY "Users can insert bidding map items" ON public.bidding_map_items
  FOR INSERT TO authenticated WITH CHECK (
    bidding_map_id IN (SELECT id FROM public.bidding_maps WHERE organization_id = get_user_organization(auth.uid()))
  );
CREATE POLICY "Users can update bidding map items" ON public.bidding_map_items
  FOR UPDATE TO authenticated USING (
    bidding_map_id IN (SELECT id FROM public.bidding_maps WHERE organization_id = get_user_organization(auth.uid()))
  );
CREATE POLICY "Users can delete bidding map items" ON public.bidding_map_items
  FOR DELETE TO authenticated USING (
    bidding_map_id IN (SELECT id FROM public.bidding_maps WHERE organization_id = get_user_organization(auth.uid()))
  );
