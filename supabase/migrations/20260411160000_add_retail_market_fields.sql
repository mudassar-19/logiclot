-- Add dealer ZIP code to preferences for local market comp lookups
ALTER TABLE dealer_preferences
  ADD COLUMN IF NOT EXISTS dealer_zip text;

-- Add market-comp tracking columns to auction_vehicles
ALTER TABLE auction_vehicles
  ADD COLUMN IF NOT EXISTS retail_data_source text DEFAULT 'mmr_estimate',
  ADD COLUMN IF NOT EXISTS market_comp_count integer,
  ADD COLUMN IF NOT EXISTS market_avg_price numeric,
  ADD COLUMN IF NOT EXISTS market_avg_mileage numeric;
