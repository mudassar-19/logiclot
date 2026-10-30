-- Add structured damage and condition fields extracted from IAA/auction run lists.
-- These replace the freeform condition_notes string for fields that have predictable values.
-- condition_notes is kept as a catch-all summary.

ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS damage_location  text,
  ADD COLUMN IF NOT EXISTS damage_type      text,
  ADD COLUMN IF NOT EXISTS drive_condition  text,
  ADD COLUMN IF NOT EXISTS body_condition   text,
  ADD COLUMN IF NOT EXISTS key_status       text,
  ADD COLUMN IF NOT EXISTS recon_damage_adj numeric DEFAULT 0;
