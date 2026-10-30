-- Fix: apply_hard_preference_filters was overriding 'Buy'/'Possible Buy' back to 'Pass'
-- for all IAA salvage vehicles via the max_recon hard cap.
--
-- Root cause: IAA salvage vehicles always have estimated_recon_cost > max_recon because
-- the profit engine adds $4,000 r_risk to recon for any salvage/rebuilt title. This is
-- a pricing signal (discounts the acquisition estimate), NOT a repair cost estimate.
-- When the dealer sets max_recon = $3,000, the recon filter catches every single IAA
-- salvage vehicle and force-sets ai_recommendation = 'Pass', wiping out the tiered
-- salvage scoring from apply_vehicle_scoring (which already applied a -15 soft penalty).
--
-- Fix: exempt salvage-titled vehicles from the recon hard cap.
-- The salvage r_risk component is already factored into estimated_profit. The scoring
-- tier applies -15 for exceeding max_recon as a soft signal. The hard cap only makes
-- sense for non-salvage vehicles where high recon is a genuine refusal condition.

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

  SELECT o.* INTO v_override
  FROM public.buy_list_override_preferences o
  JOIN public.buy_lists bl ON bl.id = o.buy_list_id
  WHERE bl.run_list_id = p_run_list_id AND bl.organization_id = v_org_id
  LIMIT 1;

  v_has_override := FOUND;

  IF v_has_override THEN
    v_preferred_brands := CASE WHEN v_override.no_brand_preference THEN '{}'::text[] ELSE COALESCE(v_override.preferred_brands, '{}') END;
    v_excluded_brands := COALESCE(v_override.excluded_brands, '{}');
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
          AND av.vehicle_type IS NOT NULL
          AND av.vehicle_type != 'Other'
          AND NOT (av.vehicle_type = ANY(v_vehicle_types)))
      OR (v_max_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > v_max_price)
      OR (v_min_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) < v_min_price)
      OR (v_min_year > 0 AND av.year IS NOT NULL AND av.year < v_min_year)
      OR (v_max_year < 9999 AND av.year IS NOT NULL AND av.year > v_max_year)
      OR (v_max_mileage > 0 AND COALESCE(av.mileage, 0) > v_max_mileage)
      OR (v_min_mileage > 0 AND av.mileage IS NOT NULL AND av.mileage < v_min_mileage)
      OR (av.cr_score IS NOT NULL AND v_min_cr > 0 AND av.cr_score < v_min_cr)
      -- allow_no_cr: exempt IAA vehicles — cr_score is structurally absent on all IAA rows,
      -- not an unknown condition. lot_number + any condition field = IAA detection.
      OR (av.cr_score IS NULL AND NOT v_allow_no_cr
          AND NOT (av.lot_number IS NOT NULL AND (
            av.title_status IS NOT NULL OR av.damage_location IS NOT NULL OR
            av.damage_type IS NOT NULL OR av.drive_condition IS NOT NULL
          )))
      -- Salvage: handled via tiered scoring penalty, not hard override.
      -- Buy list insertion is still gated in generate_buy_list_from_profit.
      OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[])))
      OR (NOT v_allow_tmu AND (COALESCE(av.title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
      -- Recon cap: exempt salvage vehicles. The r_risk component ($4,000 for salvage titles)
      -- inflates estimated_recon_cost as a pricing signal, not a repair estimate.
      -- apply_vehicle_scoring already applies -15 as a soft signal for exceeding max_recon.
      OR (v_max_recon > 0
          AND (COALESCE(av.buy_now, 0) > 0 OR COALESCE(av.price_estimate, 0) > 0 OR COALESCE(av.current_bid, 0) > 0)
          AND COALESCE(av.estimated_recon_cost, 0) > v_max_recon
          AND NOT (COALESCE(av.title_status, '') ILIKE '%salvage%')
          AND COALESCE(av.estimated_profit, 0) <= 0)
    );
END;
$function$;

ALTER FUNCTION public.apply_hard_preference_filters(uuid) SET statement_timeout = '120s';
