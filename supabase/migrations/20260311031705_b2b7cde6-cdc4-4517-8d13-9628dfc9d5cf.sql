
-- Dealer preferences table
CREATE TABLE public.dealer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_types text[] DEFAULT '{}',
  min_cr_score numeric DEFAULT 0,
  allow_no_cr boolean DEFAULT false,
  min_mileage integer DEFAULT 0,
  max_mileage integer DEFAULT 250000,
  min_price numeric DEFAULT 0,
  max_price numeric DEFAULT 100000,
  min_year integer DEFAULT 2000,
  max_year integer DEFAULT 2026,
  preferred_brands text[] DEFAULT '{}',
  excluded_brands text[] DEFAULT '{}',
  allow_salvage boolean DEFAULT false,
  allow_frame_damage boolean DEFAULT false,
  allow_accident_history boolean DEFAULT false,
  min_profit numeric DEFAULT 1000,
  preferred_auction_locations text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.dealer_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org preferences" ON public.dealer_preferences FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert their org preferences" ON public.dealer_preferences FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org preferences" ON public.dealer_preferences FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Run lists table
CREATE TABLE public.run_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Run List',
  auction_date date,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org run lists" ON public.run_lists FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert run lists" ON public.run_lists FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org run lists" ON public.run_lists FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can delete their org run lists" ON public.run_lists FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Run list vehicles (parsed from CSV)
CREATE TABLE public.run_list_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_list_id uuid NOT NULL REFERENCES public.run_lists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vin text,
  year integer,
  make text,
  model text,
  mileage integer,
  lane_number integer,
  run_order integer,
  cr_score numeric,
  estimated_retail_value numeric,
  estimated_recon_cost numeric,
  estimated_profit numeric,
  recommended_max_bid numeric,
  in_buy_list boolean DEFAULT false,
  dealer_notes text,
  dealer_max_bid_override numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_list_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org vehicles" ON public.run_list_vehicles FOR SELECT TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can insert vehicles" ON public.run_list_vehicles FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can update their org vehicles" ON public.run_list_vehicles FOR UPDATE TO authenticated USING (organization_id = get_user_organization(auth.uid()));
CREATE POLICY "Users can delete their org vehicles" ON public.run_list_vehicles FOR DELETE TO authenticated USING (organization_id = get_user_organization(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_dealer_preferences_updated_at BEFORE UPDATE ON public.dealer_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_run_lists_updated_at BEFORE UPDATE ON public.run_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
