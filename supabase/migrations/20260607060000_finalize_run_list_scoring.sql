-- Consolidate post-pricing scoring into one RPC so every upload path
-- (ADESA/Manheim/CarMax/IAA/CSV/Excel) always assigns ai_recommendation labels.

CREATE OR REPLACE FUNCTION public.finalize_run_list_scoring(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout = '300s'
AS $function$
BEGIN
  PERFORM public.apply_dealer_demand_scoring(p_run_list_id);
  PERFORM public.apply_vehicle_scoring(p_run_list_id);
  PERFORM public.apply_hard_preference_filters(p_run_list_id);
  PERFORM public.apply_recommendation_from_score(p_run_list_id);
  PERFORM public.generate_vehicle_recommendation_reason(p_run_list_id);
END;
$function$;

ALTER FUNCTION public.finalize_run_list_scoring(uuid) SET statement_timeout = '300s';


-- Safety net: backfill recommendations when scoring completed but labels are still
-- the DB default placeholder ('review' / NULL). Runs before buy-list item selection.
CREATE OR REPLACE FUNCTION public.ensure_run_list_recommendations(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.auction_vehicles av
    WHERE av.run_list_id = p_run_list_id
      AND av.profit_score IS NOT NULL
      AND lower(trim(coalesce(av.ai_recommendation, 'review'))) = 'review'
  ) THEN
    PERFORM public.apply_recommendation_from_score(p_run_list_id);
  END IF;
END;
$function$;


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

  PERFORM public.ensure_run_list_recommendations(p_run_list_id);

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
      v_preferred_brands := '{}'; v_excluded_brands := '{}'; v_vehicle_types := '{}';
      v_min_price := 0; v_max_price := 0; v_min_year := 0; v_max_year := 9999;
      v_min_mileage := 0; v_max_mileage := 0; v_min_cr := 0;
      v_allow_no_cr := true; v_allow_salvage := true; v_allow_frame := true;
      v_allow_tmu := true; v_max_recon := 0;
    END IF;
  END IF;

  IF array_length(v_preferred_brands, 1) > 0 THEN
    SELECT count(*) INTO v_exc_brand FROM public.auction_vehicles WHERE run_list_id = p_run_list_id AND NOT (upper(COALESCE(make, '')) = ANY(SELECT upper(unnest(v_preferred_brands))));
  END IF;
  IF array_length(v_vehicle_types, 1) > 0 THEN
    SELECT count(*) INTO v_exc_type FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND vehicle_type IS NOT NULL
      AND vehicle_type != 'Other'
      AND NOT (vehicle_type = ANY(v_vehicle_types));
  END IF;
  IF v_max_price > 0 THEN
    SELECT count(*) INTO v_exc_price FROM public.auction_vehicles WHERE run_list_id = p_run_list_id AND COALESCE(buy_now, mmr_value, price_estimate, current_bid, 0) > v_max_price;
  END IF;
  IF v_max_mileage > 0 THEN
    SELECT count(*) INTO v_exc_mileage FROM public.auction_vehicles WHERE run_list_id = p_run_list_id AND COALESCE(mileage, 0) > v_max_mileage;
  END IF;
  IF v_min_year > 0 THEN
    SELECT count(*) INTO v_exc_year FROM public.auction_vehicles WHERE run_list_id = p_run_list_id AND year IS NOT NULL AND year < v_min_year;
  END IF;
  SELECT count(*) INTO v_exc_cr FROM public.auction_vehicles
  WHERE run_list_id = p_run_list_id
    AND (
      (cr_score IS NOT NULL AND v_min_cr > 0 AND cr_score < v_min_cr)
      OR (cr_score IS NULL AND NOT v_allow_no_cr)
    );
  IF v_max_recon > 0 THEN
    SELECT count(*) INTO v_exc_recon FROM public.auction_vehicles
    WHERE run_list_id = p_run_list_id
      AND (COALESCE(buy_now, 0) > 0 OR COALESCE(price_estimate, 0) > 0 OR COALESCE(current_bid, 0) > 0)
      AND COALESCE(estimated_recon_cost, 0) > v_max_recon;
  END IF;
  IF NOT v_allow_tmu THEN
    SELECT count(*) INTO v_exc_tmu FROM public.auction_vehicles WHERE run_list_id = p_run_list_id AND (COALESCE(title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(risk_flags, '{}'::text[])));
  END IF;
  IF NOT v_allow_salvage OR NOT v_allow_frame THEN
    SELECT count(*) INTO v_exc_risk FROM public.auction_vehicles WHERE run_list_id = p_run_list_id AND ((NOT v_allow_salvage AND COALESCE(title_status, '') ILIKE '%salvage%') OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(risk_flags, '{}'::text[]))));
  END IF;

  INSERT INTO public.buy_list_items (buy_list_id, auction_vehicle_id, custom_max_bid, dealer_notes)
  SELECT bl.id, av.id, av.recommended_max_bid, 'Auto-selected by LogicLot'
  FROM public.auction_vehicles av
  JOIN public.buy_lists bl ON bl.run_list_id = av.run_list_id AND bl.organization_id = v_org_id
  WHERE av.run_list_id = p_run_list_id
    AND av.ai_recommendation IN ('Strong Buy', 'Buy', 'Possible Buy')
    AND (array_length(v_preferred_brands, 1) IS NULL OR upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_preferred_brands))))
    AND (array_length(v_excluded_brands, 1) IS NULL OR NOT (upper(COALESCE(av.make, '')) = ANY(SELECT upper(unnest(v_excluded_brands)))))
    AND (array_length(v_vehicle_types, 1) IS NULL OR av.vehicle_type IS NULL OR av.vehicle_type = 'Other' OR av.vehicle_type = ANY(v_vehicle_types))
    AND (v_max_price <= 0 OR COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) <= v_max_price)
    AND (v_min_price <= 0 OR COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) >= v_min_price)
    AND (v_min_year <= 0 OR COALESCE(av.year, 9999) >= v_min_year)
    AND (v_max_year >= 9999 OR COALESCE(av.year, 0) <= v_max_year)
    AND (v_max_mileage <= 0 OR COALESCE(av.mileage, 0) <= v_max_mileage)
    AND (v_min_mileage <= 0 OR COALESCE(av.mileage, 0) >= v_min_mileage)
    AND (
      (av.cr_score IS NOT NULL AND (v_min_cr <= 0 OR av.cr_score >= v_min_cr))
      OR (av.cr_score IS NULL AND v_allow_no_cr)
    )
    AND (v_allow_salvage OR NOT COALESCE(av.title_status, '') ILIKE '%salvage%')
    AND (v_allow_frame OR NOT ('Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
    AND (v_allow_tmu OR (NOT COALESCE(av.title_status, '') ILIKE '%tmu%' AND NOT ('TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[])))))
    AND (v_max_recon <= 0 OR (COALESCE(av.buy_now, 0) <= 0 AND COALESCE(av.price_estimate, 0) <= 0 AND COALESCE(av.current_bid, 0) <= 0) OR COALESCE(av.estimated_recon_cost, 0) <= v_max_recon)
    AND NOT EXISTS (SELECT 1 FROM public.buy_list_items bli WHERE bli.buy_list_id = bl.id AND bli.auction_vehicle_id = av.id)
  ORDER BY av.profit_score DESC NULLS LAST, av.estimated_profit DESC NULLS LAST
  LIMIT 50;

  GET DIAGNOSTICS v_saved = ROW_COUNT;

  SELECT count(*) INTO v_eligible FROM public.auction_vehicles
  WHERE run_list_id = p_run_list_id AND ai_recommendation IN ('Strong Buy', 'Buy', 'Possible Buy');

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
      'preferred_brands', v_preferred_brands, 'excluded_brands', v_excluded_brands,
      'vehicle_types', v_vehicle_types,
      'max_price', v_max_price, 'min_price', v_min_price,
      'max_mileage', v_max_mileage, 'min_year', v_min_year, 'max_year', v_max_year,
      'min_cr', v_min_cr, 'allow_no_cr', v_allow_no_cr,
      'allow_salvage', v_allow_salvage, 'allow_frame', v_allow_frame,
      'allow_tmu', v_allow_tmu, 'max_recon', v_max_recon
    ),
    v_total, v_exc_brand, v_exc_type,
    v_exc_price, v_exc_year, v_exc_mileage,
    v_exc_cr, v_exc_tmu, v_exc_risk, v_exc_recon,
    v_eligible, v_saved
  );
END;
$function$;

ALTER FUNCTION public.generate_buy_list_from_profit(uuid) SET statement_timeout = '120s';
