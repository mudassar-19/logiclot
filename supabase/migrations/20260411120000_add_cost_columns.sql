-- Add missing columns required by calculate_run_list_profit_engine
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS estimated_transport_cost numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_auction_fee    numeric DEFAULT NULL;
