-- ============================================================
-- Fix: Add columns that exist on Lovable DB but were never
-- captured in migrations. Required by edge functions, scoring
-- functions, and frontend.
-- ============================================================

-- auction_vehicles: columns used by parse-run-list edge function
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS mmr_value numeric,
  ADD COLUMN IF NOT EXISTS current_bid numeric,
  ADD COLUMN IF NOT EXISTS buy_now numeric,
  ADD COLUMN IF NOT EXISTS price_estimate numeric;

-- auction_vehicles: columns used by scoring functions
-- (apply_vehicle_scoring, generate_vehicle_recommendation_reason)
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS profit_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dealer_demand_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand_match boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS model_match boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommendation_reason text;

-- auction_run_lists: parse_status used by edge function & ProcessingScreen.tsx
ALTER TABLE public.auction_run_lists
  ADD COLUMN IF NOT EXISTS parse_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sales_history_parse_status text;
