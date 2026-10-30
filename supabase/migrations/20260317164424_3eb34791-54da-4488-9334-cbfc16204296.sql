
-- ============================================================
-- Fix: Enforce dealer preferences as HARD FILTERS in Buy List
-- ============================================================

-- 1. Add vehicle_type column for body-type filtering
ALTER TABLE public.auction_vehicles ADD COLUMN IF NOT EXISTS vehicle_type text;

-- 2. Function to infer vehicle body type from make/model
CREATE OR REPLACE FUNCTION public.infer_vehicle_types(p_run_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suv_models text[] := ARRAY[
    'CR-V','CRV','RAV4','HIGHLANDER','4RUNNER','PILOT','PASSPORT','HR-V','HRV',
    'TUCSON','SANTA FE','PALISADE','KONA','VENUE','IONIQ 5','IONIQ 6',
    'SORENTO','TELLURIDE','SPORTAGE','SELTOS','NIRO','EV6','EV9',
    'EQUINOX','BLAZER','TRAVERSE','TAHOE','SUBURBAN','TRAILBLAZER','TRAX','BOLT',
    'ESCAPE','EXPLORER','EXPEDITION','BRONCO','BRONCO SPORT','EDGE',
    'ENVISION','ENCLAVE','ENCORE','ENCORE GX',
    'ACADIA','TERRAIN','YUKON','HUMMER EV',
    'CHEROKEE','COMPASS','GRAND CHEROKEE','GRAND CHEROKEE L','RENEGADE','WRANGLER','WAGONEER',
    'X1','X3','X5','X6','X7','IX',
    'Q3','Q5','Q7','Q8','E-TRON','ETRON',
    'GLA','GLB','GLC','GLE','GLS','EQB',
    'NX','RX','UX','GX','LX','TX','RZ',
    'MDX','RDX',
    'QX50','QX55','QX60','QX80',
    'CAYENNE','MACAN',
    'MODEL X','MODEL Y',
    'DEFENDER','DISCOVERY','DISCOVERY SPORT','RANGE ROVER','RANGE ROVER EVOQUE','RANGE ROVER SPORT','RANGE ROVER VELAR',
    'STELVIO','TONALE',
    'XC40','XC60','XC90','C40',
    'TIGUAN','ATLAS','ATLAS CROSS SPORT','TAOS','ID.4','ID4',
    'CROSSTREK','FORESTER','OUTBACK','ASCENT','SOLTERRA',
    'OUTLANDER','OUTLANDER SPORT','ECLIPSE CROSS',
    'KICKS','MURANO','PATHFINDER','ROGUE','ROGUE SPORT','ARIYA',
    'CX-30','CX30','CX-5','CX5','CX-50','CX50','CX-90','CX90',
    'CORSAIR','AVIATOR','NAUTILUS','NAVIGATOR',
    'LYRIQ','XT4','XT5','XT6','ESCALADE',
    'GV60','GV70','GV80',
    'R1S',
    'E-PACE','F-PACE','I-PACE',
    'HORNET','DURANGO',
    'BZ4X','LAND CRUISER','SEQUOIA','VENZA'
  ];
  v_truck_models text[] := ARRAY[
    'F-150','F-250','F-350','F150','F250','F350',
    'SILVERADO','SIERRA','COLORADO','CANYON',
    'TACOMA','TUNDRA',
    'RANGER','MAVERICK',
    'FRONTIER','TITAN',
    'RIDGELINE','GLADIATOR','SANTA CRUZ',
    'CYBERTRUCK','R1T'
  ];
  v_van_models text[] := ARRAY[
    'ODYSSEY','SIENNA','PACIFICA','CARNIVAL','VOYAGER',
    'TRANSIT','TRANSIT CONNECT','PROMASTER','METRIS',
    'NV200','NV','SPRINTER'
  ];
  v_coupe_models text[] := ARRAY[
    'MUSTANG','CAMARO','CORVETTE','CHALLENGER',
    '2 SERIES','4 SERIES','8 SERIES','M4',
    'RC','LC','718','911',
    'GR86','GR 86','BRZ','GR SUPRA','SUPRA',
    'MX-5','MX5','MIATA','MX-5 MIATA',
    'Z','370Z','350Z','TT','F-TYPE'
  ];
  v_sedan_models text[] := ARRAY[
    'ACCORD','CIVIC','CAMRY','COROLLA','PRIUS',
    'ALTIMA','SENTRA','MAXIMA','VERSA','LEAF',
    'ELANTRA','SONATA','FORTE','K5','STINGER',
    'JETTA','GOLF','PASSAT',
    '3 SERIES','5 SERIES','7 SERIES','I4',
    'A3','A4','A5','A6','A7','A8','S4','S5','RS5',
    'C-CLASS','E-CLASS','S-CLASS','A-CLASS','CLA',
    'IS','ES','LS',
    'CT4','CT5','Q50','Q60',
    'G70','G80','G90',
    'MODEL 3','MODEL S',
    'S60','S90','V60','V90',
    'GIULIA','TLX','ILX','INTEGRA',
    'MALIBU','300',
    'IMPREZA','LEGACY','WRX',
    'MAZDA3','CHARGER','SOUL','MIRAGE'
  ];
BEGIN
  UPDATE public.auction_vehicles av
  SET vehicle_type =
    CASE
      WHEN upper(COALESCE(av.model, '')) = ANY(v_truck_models) THEN 'Truck'
      WHEN upper(COALESCE(av.make, '')) = 'RAM' THEN 'Truck'
      WHEN upper(COALESCE(av.model, '')) LIKE '%1500%' OR upper(COALESCE(av.model, '')) LIKE '%2500%' OR upper(COALESCE(av.model, '')) LIKE '%3500%' THEN 'Truck'
      WHEN upper(COALESCE(av.model, '')) = ANY(v_van_models) THEN 'Van'
      WHEN upper(COALESCE(av.model, '')) = ANY(v_suv_models) THEN 'SUV'
      WHEN upper(COALESCE(av.model, '')) = ANY(v_coupe_models) THEN 'Coupe'
      WHEN upper(COALESCE(av.model, '')) = ANY(v_sedan_models) THEN 'Sedan'
      ELSE 'Other'
    END
  WHERE av.run_list_id = p_run_list_id;
END;
$$;

-- 3. Create audit log table for buy list generation
CREATE TABLE public.buy_list_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  run_list_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  preferences_snapshot jsonb DEFAULT '{}'::jsonb,
  total_vehicles integer DEFAULT 0,
  excluded_by_brand integer DEFAULT 0,
  excluded_by_vehicle_type integer DEFAULT 0,
  excluded_by_price integer DEFAULT 0,
  excluded_by_year integer DEFAULT 0,
  excluded_by_mileage integer DEFAULT 0,
  excluded_by_cr integer DEFAULT 0,
  excluded_by_tmu integer DEFAULT 0,
  excluded_by_risk integer DEFAULT 0,
  excluded_by_recon integer DEFAULT 0,
  eligible_after_filters integer DEFAULT 0,
  recommended_saved integer DEFAULT 0
);

ALTER TABLE public.buy_list_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org generation logs"
ON public.buy_list_generation_logs FOR SELECT TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

-- 4. Function to apply hard filters AFTER scoring (overrides recommendation to Pass)
CREATE OR REPLACE FUNCTION public.apply_hard_preference_filters(p_run_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefs record;
  v_org_id uuid;
  v_preferred_brands text[];
  v_excluded_brands text[];
  v_vehicle_types text[];
  v_max_price numeric;
  v_min_price numeric;
  v_min_year integer;
  v_max_year integer;
  v_min_mileage integer;
  v_max_mileage integer;
  v_min_cr numeric;
  v_allow_no_cr boolean;
  v_allow_salvage boolean;
  v_allow_frame boolean;
  v_allow_tmu boolean;
  v_max_recon numeric;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.auction_run_lists WHERE id = p_run_list_id;

  SELECT * INTO v_prefs FROM public.dealer_preferences WHERE organization_id = v_org_id LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  v_preferred_brands := COALESCE(v_prefs.preferred_brands, '{}');
  v_excluded_brands := COALESCE(v_prefs.excluded_brands, '{}');
  v_vehicle_types := COALESCE(v_prefs.vehicle_types, '{}');
  v_min_price := COALESCE(v_prefs.min_price, 0);
  v_max_price := COALESCE(v_prefs.max_price, 0);
  v_min_year := COALESCE(v_prefs.min_year, 0);
  v_max_year := COALESCE(v_prefs.max_year, 9999);
  v_min_mileage := COALESCE(v_prefs.min_mileage, 0);
  v_max_mileage := COALESCE(v_prefs.max_mileage, 0);
  v_min_cr := COALESCE(v_prefs.min_cr_score, 0);
  v_allow_no_cr := COALESCE(v_prefs.allow_no_cr, true);
  v_allow_salvage := COALESCE(v_prefs.allow_salvage, false);
  v_allow_frame := COALESCE(v_prefs.allow_frame_damage, false);
  v_allow_tmu := COALESCE(v_prefs.allow_tmu, true);
  v_max_recon := COALESCE(v_prefs.max_recon_cost, 0);

  -- Mark vehicles that FAIL any hard filter as Pass
  UPDATE public.auction_vehicles av
  SET
    ai_recommendation = 'Pass',
    ai_summary = 'Excluded: does not match your saved buying preferences.'
  WHERE av.run_list_id = p_run_list_id
    AND (
      -- Brand filter: if preferred brands set, only allow those
      (array_length(v_preferred_brands, 1) > 0
       AND NOT (upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_preferred_brands)))))
      -- Excluded brands
      OR (array_length(v_excluded_brands, 1) > 0
          AND upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_excluded_brands))))
      -- Vehicle type filter
      OR (array_length(v_vehicle_types, 1) > 0
          AND NOT (COALESCE(av.vehicle_type, 'Other') = ANY(v_vehicle_types)))
      -- Max price
      OR (v_max_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > v_max_price)
      -- Min price
      OR (v_min_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) < v_min_price)
      -- Year range
      OR (v_min_year > 0 AND av.year IS NOT NULL AND av.year < v_min_year)
      OR (v_max_year < 9999 AND av.year IS NOT NULL AND av.year > v_max_year)
      -- Mileage
      OR (v_max_mileage > 0 AND COALESCE(av.mileage, 0) > v_max_mileage)
      OR (v_min_mileage > 0 AND av.mileage IS NOT NULL AND av.mileage < v_min_mileage)
      -- CR score
      OR (v_min_cr > 0 AND av.cr_score IS NOT NULL AND av.cr_score < v_min_cr)
      OR (v_min_cr > 0 AND av.cr_score IS NULL AND NOT v_allow_no_cr)
      -- Salvage
      OR (NOT v_allow_salvage AND COALESCE(av.title_status, '') ILIKE '%salvage%')
      -- Frame damage
      OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[])))
      -- TMU
      OR (NOT v_allow_tmu AND (COALESCE(av.title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
      -- Recon cost
      OR (v_max_recon > 0 AND COALESCE(av.estimated_recon_cost, 0) > v_max_recon)
    );
END;
$$;

-- 5. Rewrite generate_buy_list_from_profit with hard filter WHERE clauses + audit logging
CREATE OR REPLACE FUNCTION public.generate_buy_list_from_profit(p_run_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefs record;
  v_has_prefs boolean;
  v_org_id uuid;
  v_total integer;
  v_saved integer;
  v_eligible integer;
  v_preferred_brands text[];
  v_excluded_brands text[];
  v_vehicle_types text[];
  v_min_price numeric;
  v_max_price numeric;
  v_min_year integer;
  v_max_year integer;
  v_min_mileage integer;
  v_max_mileage integer;
  v_min_cr numeric;
  v_allow_no_cr boolean;
  v_allow_salvage boolean;
  v_allow_frame boolean;
  v_allow_tmu boolean;
  v_max_recon numeric;
  v_exc_brand integer := 0;
  v_exc_type integer := 0;
  v_exc_price integer := 0;
  v_exc_year integer := 0;
  v_exc_mileage integer := 0;
  v_exc_cr integer := 0;
  v_exc_tmu integer := 0;
  v_exc_risk integer := 0;
  v_exc_recon integer := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.auction_run_lists WHERE id = p_run_list_id;
  SELECT count(*) INTO v_total FROM public.auction_vehicles WHERE run_list_id = p_run_list_id;

  SELECT * INTO v_prefs FROM public.dealer_preferences WHERE organization_id = v_org_id LIMIT 1;
  v_has_prefs := FOUND;

  IF v_has_prefs THEN
    v_preferred_brands := COALESCE(v_prefs.preferred_brands, '{}');
    v_excluded_brands := COALESCE(v_prefs.excluded_brands, '{}');
    v_vehicle_types := COALESCE(v_prefs.vehicle_types, '{}');
    v_min_price := COALESCE(v_prefs.min_price, 0);
    v_max_price := COALESCE(v_prefs.max_price, 0);
    v_min_year := COALESCE(v_prefs.min_year, 0);
    v_max_year := COALESCE(v_prefs.max_year, 9999);
    v_min_mileage := COALESCE(v_prefs.min_mileage, 0);
    v_max_mileage := COALESCE(v_prefs.max_mileage, 0);
    v_min_cr := COALESCE(v_prefs.min_cr_score, 0);
    v_allow_no_cr := COALESCE(v_prefs.allow_no_cr, true);
    v_allow_salvage := COALESCE(v_prefs.allow_salvage, false);
    v_allow_frame := COALESCE(v_prefs.allow_frame_damage, false);
    v_allow_tmu := COALESCE(v_prefs.allow_tmu, true);
    v_max_recon := COALESCE(v_prefs.max_recon_cost, 0);
  ELSE
    v_preferred_brands := '{}';
    v_excluded_brands := '{}';
    v_vehicle_types := '{}';
    v_min_price := 0;
    v_max_price := 0;
    v_min_year := 0;
    v_max_year := 9999;
    v_min_mileage := 0;
    v_max_mileage := 0;
    v_min_cr := 0;
    v_allow_no_cr := true;
    v_allow_salvage := true;
    v_allow_frame := true;
    v_allow_tmu := true;
    v_max_recon := 0;
  END IF;

  -- Count per-filter exclusions for audit
  IF array_length(v_preferred_brands, 1) > 0 THEN
    SELECT count(*) INTO v_exc_brand FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND NOT (upper(COALESCE(make, '')) = ANY(SELECT upper(unnest(v_preferred_brands))));
  END IF;

  IF array_length(v_vehicle_types, 1) > 0 THEN
    SELECT count(*) INTO v_exc_type FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND NOT (COALESCE(vehicle_type, 'Other') = ANY(v_vehicle_types));
  END IF;

  IF v_max_price > 0 THEN
    SELECT count(*) INTO v_exc_price FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND COALESCE(buy_now, mmr_value, price_estimate, current_bid, 0) > v_max_price;
  END IF;

  IF v_max_mileage > 0 THEN
    SELECT count(*) INTO v_exc_mileage FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND COALESCE(mileage, 0) > v_max_mileage;
  END IF;

  IF v_min_year > 0 THEN
    SELECT count(*) INTO v_exc_year FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND year IS NOT NULL AND year < v_min_year;
  END IF;

  IF v_min_cr > 0 THEN
    SELECT count(*) INTO v_exc_cr FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND ((cr_score IS NOT NULL AND cr_score < v_min_cr)
           OR (cr_score IS NULL AND NOT v_allow_no_cr));
  END IF;

  IF v_max_recon > 0 THEN
    SELECT count(*) INTO v_exc_recon FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND COALESCE(estimated_recon_cost, 0) > v_max_recon;
  END IF;

  IF NOT v_allow_tmu THEN
    SELECT count(*) INTO v_exc_tmu FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND (COALESCE(title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(risk_flags, '{}'::text[])));
  END IF;

  IF NOT v_allow_salvage OR NOT v_allow_frame THEN
    SELECT count(*) INTO v_exc_risk FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND ((NOT v_allow_salvage AND COALESCE(title_status, '') ILIKE '%salvage%')
           OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(risk_flags, '{}'::text[]))));
  END IF;

  -- Insert into buy list with ALL hard filters applied as WHERE clauses
  INSERT INTO public.buy_list_items (buy_list_id, auction_vehicle_id, custom_max_bid, dealer_notes)
  SELECT
    bl.id,
    av.id,
    av.recommended_max_bid,
    'Auto-selected by LogicLot'
  FROM public.auction_vehicles av
  JOIN public.buy_lists bl ON bl.run_list_id = av.run_list_id
  WHERE av.run_list_id = p_run_list_id
    -- Only include vehicles that passed hard filters (recommendation not overridden to Pass)
    AND av.ai_recommendation IN ('Strong Buy', 'Buy')
    -- HARD FILTER: preferred brands
    AND (array_length(v_preferred_brands, 1) IS NULL
         OR upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_preferred_brands))))
    -- HARD FILTER: excluded brands
    AND (array_length(v_excluded_brands, 1) IS NULL
         OR NOT (upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_excluded_brands)))))
    -- HARD FILTER: vehicle types
    AND (array_length(v_vehicle_types, 1) IS NULL
         OR COALESCE(av.vehicle_type, 'Other') = ANY(v_vehicle_types))
    -- HARD FILTER: price range
    AND (v_max_price <= 0 OR COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) <= v_max_price)
    AND (v_min_price <= 0 OR COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) >= v_min_price)
    -- HARD FILTER: year range
    AND (v_min_year <= 0 OR COALESCE(av.year, 9999) >= v_min_year)
    AND (v_max_year >= 9999 OR COALESCE(av.year, 0) <= v_max_year)
    -- HARD FILTER: mileage range
    AND (v_max_mileage <= 0 OR COALESCE(av.mileage, 0) <= v_max_mileage)
    AND (v_min_mileage <= 0 OR COALESCE(av.mileage, 0) >= v_min_mileage)
    -- HARD FILTER: CR score
    AND (v_min_cr <= 0 OR av.cr_score >= v_min_cr OR (v_allow_no_cr AND av.cr_score IS NULL))
    -- HARD FILTER: salvage
    AND (v_allow_salvage OR NOT COALESCE(av.title_status, '') ILIKE '%salvage%')
    -- HARD FILTER: frame damage
    AND (v_allow_frame OR NOT ('Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
    -- HARD FILTER: TMU
    AND (v_allow_tmu OR (NOT COALESCE(av.title_status, '') ILIKE '%tmu%' AND NOT ('TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[])))))
    -- HARD FILTER: recon cost
    AND (v_max_recon <= 0 OR COALESCE(av.estimated_recon_cost, 0) <= v_max_recon)
    -- Dedup
    AND NOT EXISTS (
      SELECT 1 FROM public.buy_list_items bli
      WHERE bli.buy_list_id = bl.id AND bli.auction_vehicle_id = av.id
    )
  ORDER BY av.profit_score DESC NULLS LAST, av.estimated_profit DESC NULLS LAST
  LIMIT 50;

  GET DIAGNOSTICS v_saved = ROW_COUNT;

  -- Count eligible after hard filters
  SELECT count(*) INTO v_eligible FROM public.auction_vehicles
  WHERE run_list_id = p_run_list_id
    AND ai_recommendation IN ('Strong Buy', 'Buy');

  -- Write audit log
  INSERT INTO public.buy_list_generation_logs (
    organization_id, run_list_id, preferences_snapshot,
    total_vehicles, excluded_by_brand, excluded_by_vehicle_type,
    excluded_by_price, excluded_by_year, excluded_by_mileage,
    excluded_by_cr, excluded_by_tmu, excluded_by_risk, excluded_by_recon,
    eligible_after_filters, recommended_saved
  ) VALUES (
    v_org_id, p_run_list_id,
    CASE WHEN v_has_prefs THEN jsonb_build_object(
      'preferred_brands', v_preferred_brands,
      'excluded_brands', v_excluded_brands,
      'vehicle_types', v_vehicle_types,
      'max_price', v_max_price,
      'min_price', v_min_price,
      'max_mileage', v_max_mileage,
      'min_mileage', v_min_mileage,
      'min_year', v_min_year,
      'max_year', v_max_year,
      'min_cr', v_min_cr,
      'allow_no_cr', v_allow_no_cr,
      'allow_salvage', v_allow_salvage,
      'allow_frame', v_allow_frame,
      'allow_tmu', v_allow_tmu,
      'max_recon', v_max_recon
    ) ELSE '{}'::jsonb END,
    v_total, v_exc_brand, v_exc_type,
    v_exc_price, v_exc_year, v_exc_mileage,
    v_exc_cr, v_exc_tmu, v_exc_risk, v_exc_recon,
    v_eligible, v_saved
  );
END;
$$;
