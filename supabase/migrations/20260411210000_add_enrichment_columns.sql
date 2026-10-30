-- Add VIN enrichment columns for NHTSA vPIC / CarQuery / MarketCheck integration
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS engine          text,
  ADD COLUMN IF NOT EXISTS drivetrain      text,
  ADD COLUMN IF NOT EXISTS fuel_type       text,
  ADD COLUMN IF NOT EXISTS body_style      text,
  ADD COLUMN IF NOT EXISTS vin_decoded     boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS enrichment_sources text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_confidence_score integer DEFAULT 0;
