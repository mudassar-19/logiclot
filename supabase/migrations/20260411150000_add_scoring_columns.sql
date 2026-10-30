-- Add columns written by apply_vehicle_scoring that were missing from DDL
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS scoring_reasons text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_summary      text    DEFAULT NULL;
