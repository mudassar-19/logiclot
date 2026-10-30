
-- Fix the profit engine: when target_profit=0 ("No targeted profit"),
-- use a realistic cost-basis calculation instead of circular formula
CREATE OR REPLACE FUNCTION public.calculate_run_list_profit_engine(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_target_profit numeric;
  v_has_target boolean;
begin
  select dp.target_profit
  into v_target_profit
  from public.dealer_preferences dp
  join public.auction_run_lists rl
    on rl.organization_id = dp.organization_id
  where rl.id = p_run_list_id
  limit 1;

  v_has_target := coalesce(v_target_profit, 0) > 0;
  if not v_has_target then
    v_target_profit := 0;
  end if;

  update public.auction_vehicles av
  set
    estimated_recon_cost = coalesce(av.estimated_recon_cost, 1200),
    estimated_transport_cost = coalesce(av.estimated_transport_cost, 300),
    estimated_auction_fee = coalesce(av.estimated_auction_fee, 500),

    -- Retail value estimate: 15% above market value
    estimated_retail_value =
      coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15,

    -- When no target profit: recommended_max_bid = acquisition cost (the market value itself)
    -- When target profit set: back into max bid from retail minus all costs minus target profit
    recommended_max_bid =
      case when not v_has_target then
        -- bid up to market value (the actual acquisition price)
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
      else
        (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
        - v_target_profit
        - coalesce(av.estimated_recon_cost, 1200)
        - coalesce(av.estimated_transport_cost, 300)
        - coalesce(av.estimated_auction_fee, 500)
      end,

    -- Total cost = acquisition + recon + transport + auction fee
    total_estimated_cost =
      case when not v_has_target then
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
        + coalesce(av.estimated_recon_cost, 1200)
        + coalesce(av.estimated_transport_cost, 300)
        + coalesce(av.estimated_auction_fee, 500)
      else
        (
          (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
          - v_target_profit
          - coalesce(av.estimated_recon_cost, 1200)
          - coalesce(av.estimated_transport_cost, 300)
          - coalesce(av.estimated_auction_fee, 500)
        )
        + coalesce(av.estimated_recon_cost, 1200)
        + coalesce(av.estimated_transport_cost, 300)
        + coalesce(av.estimated_auction_fee, 500)
      end,

    -- Profit = retail - total cost
    estimated_profit =
      case when not v_has_target then
        -- retail - (market_value + recon + transport + fee)
        (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
        - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
        - coalesce(av.estimated_recon_cost, 1200)
        - coalesce(av.estimated_transport_cost, 300)
        - coalesce(av.estimated_auction_fee, 500)
      else
        (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
        - (
          (
            (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
            - v_target_profit
            - coalesce(av.estimated_recon_cost, 1200)
            - coalesce(av.estimated_transport_cost, 300)
            - coalesce(av.estimated_auction_fee, 500)
          )
          + coalesce(av.estimated_recon_cost, 1200)
          + coalesce(av.estimated_transport_cost, 300)
          + coalesce(av.estimated_auction_fee, 500)
        )
      end,

    -- Profit score
    profit_score =
      case
        when not v_has_target then
          -- profit = retail*0.15 - 2000 (approx), so for mmr=6000 profit ~= -1100, mmr=15000 profit ~= 250
          -- Use absolute profit thresholds
          case
            when (
              (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1200)
              - coalesce(av.estimated_transport_cost, 300)
              - coalesce(av.estimated_auction_fee, 500)
            ) >= 2000 then 100
            when (
              (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1200)
              - coalesce(av.estimated_transport_cost, 300)
              - coalesce(av.estimated_auction_fee, 500)
            ) >= 500 then 75
            when (
              (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1200)
              - coalesce(av.estimated_transport_cost, 300)
              - coalesce(av.estimated_auction_fee, 500)
            ) >= -500 then 50
            else 25
          end
        else
          case
            when (
              (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
              - (
                (
                  (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
                  - v_target_profit
                  - coalesce(av.estimated_recon_cost, 1200)
                  - coalesce(av.estimated_transport_cost, 300)
                  - coalesce(av.estimated_auction_fee, 500)
                )
                + coalesce(av.estimated_recon_cost, 1200)
                + coalesce(av.estimated_transport_cost, 300)
                + coalesce(av.estimated_auction_fee, 500)
              )
            ) >= v_target_profit then 100
            when (
              (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
              - (
                (
                  (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
                  - v_target_profit
                  - coalesce(av.estimated_recon_cost, 1200)
                  - coalesce(av.estimated_transport_cost, 300)
                  - coalesce(av.estimated_auction_fee, 500)
                )
                + coalesce(av.estimated_recon_cost, 1200)
                + coalesce(av.estimated_transport_cost, 300)
                + coalesce(av.estimated_auction_fee, 500)
              )
            ) >= v_target_profit * 0.7 then 75
            when (
              (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
              - (
                (
                  (coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15)
                  - v_target_profit
                  - coalesce(av.estimated_recon_cost, 1200)
                  - coalesce(av.estimated_transport_cost, 300)
                  - coalesce(av.estimated_auction_fee, 500)
                )
                + coalesce(av.estimated_recon_cost, 1200)
                + coalesce(av.estimated_transport_cost, 300)
                + coalesce(av.estimated_auction_fee, 500)
              )
            ) >= v_target_profit * 0.4 then 50
            else 25
          end
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;

-- Add buy_list_override_preferences table for per-buy-list overrides
CREATE TABLE IF NOT EXISTS public.buy_list_override_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_list_id uuid NOT NULL REFERENCES public.buy_lists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  preferred_brands text[] DEFAULT '{}'::text[],
  vehicle_types text[] DEFAULT '{}'::text[],
  min_price numeric DEFAULT 0,
  max_price numeric DEFAULT 0,
  min_year integer DEFAULT 0,
  max_year integer DEFAULT 9999,
  min_mileage integer DEFAULT 0,
  max_mileage integer DEFAULT 0,
  min_cr_score numeric DEFAULT 0,
  allow_no_cr boolean DEFAULT true,
  allow_salvage boolean DEFAULT false,
  allow_frame_damage boolean DEFAULT false,
  allow_tmu boolean DEFAULT true,
  allow_exotics boolean DEFAULT false,
  target_profit numeric DEFAULT 0,
  max_recon_cost numeric DEFAULT 0,
  no_brand_preference boolean DEFAULT true,
  no_targeted_profit boolean DEFAULT false,
  preferred_models text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buy_list_id)
);

ALTER TABLE public.buy_list_override_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org overrides"
  ON public.buy_list_override_preferences FOR SELECT TO authenticated
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert their org overrides"
  ON public.buy_list_override_preferences FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update their org overrides"
  ON public.buy_list_override_preferences FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete their org overrides"
  ON public.buy_list_override_preferences FOR DELETE TO authenticated
  USING (organization_id = get_user_organization(auth.uid()));

-- Update apply_hard_preference_filters to accept an optional override JSON
-- We'll create a new version that reads from override table first
CREATE OR REPLACE FUNCTION public.apply_hard_preference_filters(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_prefs record;
  v_override record;
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
  v_has_override boolean := false;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.auction_run_lists WHERE id = p_run_list_id;

  -- Check for buy-list-level override first
  SELECT o.* INTO v_override
  FROM public.buy_list_override_preferences o
  JOIN public.buy_lists bl ON bl.id = o.buy_list_id
  WHERE bl.run_list_id = p_run_list_id AND bl.organization_id = v_org_id
  LIMIT 1;

  v_has_override := FOUND;

  IF v_has_override THEN
    -- Use override preferences
    v_preferred_brands := CASE WHEN v_override.no_brand_preference THEN '{}'::text[] ELSE COALESCE(v_override.preferred_brands, '{}') END;
    v_excluded_brands := '{}'::text[];
    v_vehicle_types := COALESCE(v_override.vehicle_types, '{}');
    v_min_price := COALESCE(v_override.min_price, 0);
    v_max_price := COALESCE(v_override.max_price, 0);
    v_min_year := COALESCE(v_override.min_year, 0);
    v_max_year := COALESCE(v_override.max_year, 9999);
    v_min_mileage := COALESCE(v_override.min_mileage, 0);
    v_max_mileage := COALESCE(v_override.max_mileage, 0);
    v_min_cr := COALESCE(v_override.min_cr_score, 0);
    v_allow_no_cr := COALESCE(v_override.allow_no_cr, true);
    v_allow_salvage := COALESCE(v_override.allow_salvage, false);
    v_allow_frame := COALESCE(v_override.allow_frame_damage, false);
    v_allow_tmu := COALESCE(v_override.allow_tmu, true);
    v_max_recon := COALESCE(v_override.max_recon_cost, 0);
  ELSE
    -- Fall back to default dealer_preferences
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
  END IF;

  -- Mark vehicles that FAIL any hard filter as Pass
  UPDATE public.auction_vehicles av
  SET
    ai_recommendation = 'Pass',
    ai_summary = 'Excluded: does not match your saved buying preferences.'
  WHERE av.run_list_id = p_run_list_id
    AND (
      (array_length(v_preferred_brands, 1) > 0
       AND NOT (upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_preferred_brands)))))
      OR (array_length(v_excluded_brands, 1) > 0
          AND upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_excluded_brands))))
      OR (array_length(v_vehicle_types, 1) > 0
          AND NOT (COALESCE(av.vehicle_type, 'Other') = ANY(v_vehicle_types)))
      OR (v_max_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > v_max_price)
      OR (v_min_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) < v_min_price)
      OR (v_min_year > 0 AND av.year IS NOT NULL AND av.year < v_min_year)
      OR (v_max_year < 9999 AND av.year IS NOT NULL AND av.year > v_max_year)
      OR (v_max_mileage > 0 AND COALESCE(av.mileage, 0) > v_max_mileage)
      OR (v_min_mileage > 0 AND av.mileage IS NOT NULL AND av.mileage < v_min_mileage)
      OR (v_min_cr > 0 AND av.cr_score IS NOT NULL AND av.cr_score < v_min_cr)
      OR (v_min_cr > 0 AND av.cr_score IS NULL AND NOT v_allow_no_cr)
      OR (NOT v_allow_salvage AND COALESCE(av.title_status, '') ILIKE '%salvage%')
      OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[])))
      OR (NOT v_allow_tmu AND (COALESCE(av.title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
      OR (v_max_recon > 0 AND COALESCE(av.estimated_recon_cost, 0) > v_max_recon)
    );
END;
$function$;

-- Also update generate_buy_list_from_profit to respect overrides
CREATE OR REPLACE FUNCTION public.generate_buy_list_from_profit(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_prefs record;
  v_override record;
  v_has_prefs boolean;
  v_has_override boolean := false;
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

  -- Check for buy-list-level override first
  SELECT o.* INTO v_override
  FROM public.buy_list_override_preferences o
  JOIN public.buy_lists bl ON bl.id = o.buy_list_id
  WHERE bl.run_list_id = p_run_list_id AND bl.organization_id = v_org_id
  LIMIT 1;
  v_has_override := FOUND;

  IF v_has_override THEN
    v_preferred_brands := CASE WHEN v_override.no_brand_preference THEN '{}'::text[] ELSE COALESCE(v_override.preferred_brands, '{}') END;
    v_excluded_brands := '{}'::text[];
    v_vehicle_types := COALESCE(v_override.vehicle_types, '{}');
    v_min_price := COALESCE(v_override.min_price, 0);
    v_max_price := COALESCE(v_override.max_price, 0);
    v_min_year := COALESCE(v_override.min_year, 0);
    v_max_year := COALESCE(v_override.max_year, 9999);
    v_min_mileage := COALESCE(v_override.min_mileage, 0);
    v_max_mileage := COALESCE(v_override.max_mileage, 0);
    v_min_cr := COALESCE(v_override.min_cr_score, 0);
    v_allow_no_cr := COALESCE(v_override.allow_no_cr, true);
    v_allow_salvage := COALESCE(v_override.allow_salvage, false);
    v_allow_frame := COALESCE(v_override.allow_frame_damage, false);
    v_allow_tmu := COALESCE(v_override.allow_tmu, true);
    v_max_recon := COALESCE(v_override.max_recon_cost, 0);
    v_has_prefs := true;
  ELSE
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

  -- Insert into buy list with ALL hard filters applied
  INSERT INTO public.buy_list_items (buy_list_id, auction_vehicle_id, custom_max_bid, dealer_notes)
  SELECT
    bl.id,
    av.id,
    av.recommended_max_bid,
    'Auto-selected by LogicLot'
  FROM public.auction_vehicles av
  JOIN public.buy_lists bl ON bl.run_list_id = av.run_list_id AND bl.organization_id = v_org_id
  WHERE av.run_list_id = p_run_list_id
    AND av.ai_recommendation IN ('Strong Buy', 'Buy')
    AND (array_length(v_preferred_brands, 1) IS NULL
         OR upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_preferred_brands))))
    AND (array_length(v_excluded_brands, 1) IS NULL
         OR NOT (upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_excluded_brands)))))
    AND (array_length(v_vehicle_types, 1) IS NULL
         OR COALESCE(av.vehicle_type, 'Other') = ANY(v_vehicle_types))
    AND (v_max_price <= 0 OR COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) <= v_max_price)
    AND (v_min_price <= 0 OR COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) >= v_min_price)
    AND (v_min_year <= 0 OR COALESCE(av.year, 9999) >= v_min_year)
    AND (v_max_year >= 9999 OR COALESCE(av.year, 0) <= v_max_year)
    AND (v_max_mileage <= 0 OR COALESCE(av.mileage, 0) <= v_max_mileage)
    AND (v_min_mileage <= 0 OR COALESCE(av.mileage, 0) >= v_min_mileage)
    AND (v_min_cr <= 0 OR av.cr_score >= v_min_cr OR (v_allow_no_cr AND av.cr_score IS NULL))
    AND (v_allow_salvage OR NOT COALESCE(av.title_status, '') ILIKE '%salvage%')
    AND (v_allow_frame OR NOT ('Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
    AND (v_allow_tmu OR (NOT COALESCE(av.title_status, '') ILIKE '%tmu%' AND NOT ('TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[])))))
    AND (v_max_recon <= 0 OR COALESCE(av.estimated_recon_cost, 0) <= v_max_recon)
    AND NOT EXISTS (
      SELECT 1 FROM public.buy_list_items bli
      WHERE bli.buy_list_id = bl.id AND bli.auction_vehicle_id = av.id
    )
  ORDER BY av.profit_score DESC NULLS LAST, av.estimated_profit DESC NULLS LAST
  LIMIT 50;

  GET DIAGNOSTICS v_saved = ROW_COUNT;

  SELECT count(*) INTO v_eligible FROM public.auction_vehicles
  WHERE run_list_id = p_run_list_id
    AND ai_recommendation IN ('Strong Buy', 'Buy');

  INSERT INTO public.buy_list_generation_logs (
    organization_id, run_list_id, preferences_snapshot,
    total_vehicles, excluded_by_brand, excluded_by_vehicle_type,
    excluded_by_price, excluded_by_year, excluded_by_mileage,
    excluded_by_cr, excluded_by_tmu, excluded_by_risk, excluded_by_recon,
    eligible_after_filters, recommended_saved
  ) VALUES (
    v_org_id, p_run_list_id,
    jsonb_build_object(
      'source', case when v_has_override then 'buy_list_override' else 'dealer_preferences' end,
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
    ),
    v_total, v_exc_brand, v_exc_type,
    v_exc_price, v_exc_year, v_exc_mileage,
    v_exc_cr, v_exc_tmu, v_exc_risk, v_exc_recon,
    v_eligible, v_saved
  );
END;
$function$;
