-- Add ai_insight column to store on-demand Gemini-generated summaries.
-- Separate from ai_summary (template text) so caching works: if non-null, we never call Gemini again.
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS ai_insight text DEFAULT NULL;
