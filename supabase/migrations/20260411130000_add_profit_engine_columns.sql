-- Add columns written by calculate_run_list_profit_engine that were missing from DDL
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS total_estimated_cost  numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_profit      numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recommended_max_bid   numeric DEFAULT NULL;
