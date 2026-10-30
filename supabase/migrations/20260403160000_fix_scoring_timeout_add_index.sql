-- Fix: 20K-row run lists cause "statement timeout" during scoring pipeline.
-- Root cause: no index on auction_vehicles(run_list_id), plus Supabase default 8s timeout.
-- Two fixes applied:
--   1) B-tree index on auction_vehicles(run_list_id) -> eliminates full table scans
--   2) Increase statement_timeout on all scoring functions to 120s
--   3) Fix infer_vehicle_types to preserve CSV-provided vehicle_type values

-- ═══ 1. ADD MISSING INDEX ═══
CREATE INDEX IF NOT EXISTS idx_auction_vehicles_run_list_id
  ON public.auction_vehicles (run_list_id);

-- Also add a composite index for the buy-list generation query pattern
CREATE INDEX IF NOT EXISTS idx_auction_vehicles_run_list_recommendation
  ON public.auction_vehicles (run_list_id, ai_recommendation)
  WHERE ai_recommendation IN ('Strong Buy', 'Buy', 'Possible Buy');

-- ═══ 2. SET STATEMENT TIMEOUT ON SCORING FUNCTIONS ═══
-- SECURITY DEFINER functions respect ALTER FUNCTION SET for GUC overrides.
-- 120s is generous; with the index above, 20K rows should finish in <10s.

ALTER FUNCTION public.infer_vehicle_types(uuid)
  SET statement_timeout = '120s';

ALTER FUNCTION public.calculate_run_list_profit_engine(uuid)
  SET statement_timeout = '120s';

ALTER FUNCTION public.apply_vehicle_scoring(uuid)
  SET statement_timeout = '120s';

ALTER FUNCTION public.generate_vehicle_recommendation_reason(uuid)
  SET statement_timeout = '120s';

ALTER FUNCTION public.apply_hard_preference_filters(uuid)
  SET statement_timeout = '120s';

ALTER FUNCTION public.generate_buy_list_from_profit(uuid)
  SET statement_timeout = '120s';

-- apply_dealer_demand_scoring may not exist in all environments; wrap in DO block
DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.apply_dealer_demand_scoring(uuid) SET statement_timeout = ''120s''';
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'apply_dealer_demand_scoring(uuid) not found — skipping timeout config';
END $$;
