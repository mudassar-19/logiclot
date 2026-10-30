-- Add market metrics columns to auction_vehicles
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS avg_days_to_sell numeric,
  ADD COLUMN IF NOT EXISTS market_day_supply numeric,
  ADD COLUMN IF NOT EXISTS dom_sample_count  integer;

-- Add focus_on preference to dealer_preferences
ALTER TABLE public.dealer_preferences
  ADD COLUMN IF NOT EXISTS focus_on text DEFAULT 'both'
    CHECK (focus_on IN ('mds', 'days_to_sell', 'both'));
