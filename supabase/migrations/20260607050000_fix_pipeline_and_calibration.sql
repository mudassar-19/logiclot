-- Pipeline + calibration overhaul:
--
-- 1. compute_salvage_acquisition_estimate — new standalone function.
-- 2. apply_vehicle_scoring — strip ai_recommendation / ai_summary out of pass 2.
-- 3. apply_recommendation_from_score — NEW function (ADESA tiers: Strong Buy / Buy / Possible Buy).
-- 4. apply_hard_preference_filters — mileage fix + IAA max_price fix.
-- 5. infer_vehicle_types — add Excursion (SUV) and Crown Victoria (Sedan).
--
-- NOTE: calculate_run_list_profit_engine lives in 20240607000001_fix_no_price_profit_engine.sql


-- ─── 1. compute_salvage_acquisition_estimate ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_salvage_acquisition_estimate(
  p_price_estimate  numeric,
  p_drive_condition text,
  p_damage_location text,
  p_body_condition  text
) RETURNS numeric
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT round(
    p_price_estimate * CASE
      WHEN lower(coalesce(p_drive_condition, '')) LIKE '%run%drive%'
       AND lower(coalesce(p_body_condition,  '')) NOT LIKE '%deploy%'
      THEN CASE
        WHEN lower(coalesce(p_damage_location, '')) LIKE '%all over%'
          THEN 0.22
        WHEN lower(coalesce(p_damage_location, '')) LIKE '%front%'
         AND lower(coalesce(p_damage_location, '')) LIKE '%rear%'
          THEN 0.25
        ELSE 0.38
      END
      WHEN lower(coalesce(p_drive_condition, '')) LIKE '%start%'
       AND lower(coalesce(p_drive_condition, '')) NOT LIKE '%no start%'
      THEN 0.25
      ELSE 0.20
    END
  , 0)
$$;


-- ─── 2. apply_vehicle_scoring ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_vehicle_scoring(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_prefs record;
  v_has_prefs boolean := false;
  v_pref_brands text[];
  v_pref_models text[];
  v_min_cr numeric;
  v_max_mileage integer;
  v_max_recon numeric;
  v_allow_salvage boolean;
  v_allow_frame boolean;
  v_focus_on text;
  v_target_profit numeric;
  v_has_target boolean;
begin
  select dp.*
  into v_prefs
  from public.dealer_preferences dp
  join public.auction_run_lists rl on rl.organization_id = dp.organization_id
  where rl.id = p_run_list_id
  limit 1;

  v_has_prefs := found;

  if v_has_prefs then
    v_pref_brands   := coalesce(v_prefs.preferred_brands, '{}');
    v_pref_models   := coalesce(v_prefs.preferred_models, '{}');
    v_min_cr        := coalesce(v_prefs.min_cr_score, 0);
    v_max_mileage   := coalesce(v_prefs.max_mileage, 999999);
    v_max_recon     := coalesce(v_prefs.max_recon_cost, 999999);
    v_allow_salvage := coalesce(v_prefs.allow_salvage, false);
    v_allow_frame   := coalesce(v_prefs.allow_frame_damage, false);
    v_focus_on      := coalesce(v_prefs.focus_on, 'both');
    v_target_profit := coalesce(v_prefs.target_profit, 0);
    v_has_target    := v_target_profit > 0;
  else
    v_pref_brands   := '{}';
    v_pref_models   := '{}';
    v_min_cr        := 0;
    v_max_mileage   := 999999;
    v_max_recon     := 999999;
    v_allow_salvage := false;
    v_allow_frame   := false;
    v_focus_on      := 'both';
    v_target_profit := 0;
    v_has_target    := false;
  end if;

  -- Pass 0: promote announcement-derived title_status from condition_notes when not already set.
  update public.auction_vehicles av
  set title_status = 'Salvage'
  where av.run_list_id = p_run_list_id
    and coalesce(av.title_status, '') = ''
    and av.condition_notes ilike '%salvage history%';

  -- Pass 1: compute profit_score only.
  update public.auction_vehicles av
  set
    profit_score = greatest(0, least(100,
      (case
        when coalesce(av.estimated_retail_value, 0) <= 0 then 0
        when v_has_target then case
          when coalesce(av.estimated_profit, 0) >= v_target_profit        then 100
          when coalesce(av.estimated_profit, 0) >= v_target_profit * 0.80 then 85
          when coalesce(av.estimated_profit, 0) >= v_target_profit * 0.60 then 70
          when coalesce(av.estimated_profit, 0) >= 0                      then 50
          else 25
        end
        else case
          when (coalesce(av.estimated_profit, 0)::numeric / av.estimated_retail_value) >= 0.20 then 100
          when (coalesce(av.estimated_profit, 0)::numeric / av.estimated_retail_value) >= 0.15 then 85
          when (coalesce(av.estimated_profit, 0)::numeric / av.estimated_retail_value) >= 0.10 then 70
          when coalesce(av.estimated_profit, 0) >= 0                                           then 50
          else 25
        end
      end)
      + case when array_length(v_pref_brands, 1) > 0
             and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
      + case when array_length(v_pref_models, 1) > 0
             and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
      + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
      + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null
             then case
               when av.avg_days_to_sell <= 15 then 15
               when av.avg_days_to_sell <= 20 then 10
               when av.avg_days_to_sell <= 30 then 5
               when av.avg_days_to_sell <= 45 then 0
               when av.avg_days_to_sell <= 60 then -5
               else -12
             end
             else 0 end
      + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null
             then case
               when av.market_day_supply <= 20 then 10
               when av.market_day_supply <= 30 then 5
               when av.market_day_supply <= 45 then 0
               when av.market_day_supply <= 60 then -5
               else -10
             end
             else 0 end
      - case when not v_allow_salvage
             and coalesce(av.title_status, '') ilike '%salvage%' then
          case
            when coalesce(av.estimated_profit, 0) >= 20000 then  5
            when coalesce(av.estimated_profit, 0) >= 10000 then 15
            when coalesce(av.estimated_profit, 0) >=  5000 then 25
            when coalesce(av.estimated_profit, 0) >=  3000 then 35
            else 50
          end
        else 0 end
      - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
      - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
      - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
      - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
    ))
  where av.run_list_id = p_run_list_id;

  -- Pass 2: scoring_reasons, risk_flags, ai_summary.
  -- ai_recommendation is NOT set here; apply_recommendation_from_score owns that column.
  update public.auction_vehicles av
  set
    scoring_reasons = array_remove(array[
      case when coalesce(av.profit_score, 0) >= 100 then 'Meets target profit' end,
      case when coalesce(av.profit_score, 0) >= 75 and coalesce(av.profit_score, 0) < 100 then 'Strong projected margin' end,
      case when coalesce(av.profit_score, 0) >= 50 and coalesce(av.profit_score, 0) < 75 then 'Moderate projected margin' end,
      case when coalesce(av.estimated_profit, 0) < 0 then 'Negative estimated profit' end,
      case when coalesce(av.mileage, 0) <= v_max_mileage then 'Mileage within preferred range' end,
      case when coalesce(av.mileage, 0) > v_max_mileage then 'Higher mileage unit' end,
      case when coalesce(av.title_status, '') ilike '%clean%'
             or coalesce(av.title_status, '') ilike '%clear%' then 'Clean title' end,
      case when coalesce(av.title_status, '') <> ''
             and coalesce(av.title_status, '') not ilike '%clean%'
             and coalesce(av.title_status, '') not ilike '%clear%' then 'Title requires review' end,
      case when array_length(v_pref_brands, 1) > 0
           and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 'Preferred brand match' end,
      case when array_length(v_pref_models, 1) > 0
           and upper(av.model) = any(select upper(unnest(v_pref_models))) then 'Preferred model match' end,
      case when av.cr_score is not null and av.cr_score >= v_min_cr then 'CR score meets minimum' end,
      case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null
           and av.avg_days_to_sell <= 20 then 'Fast-moving inventory (< 20 days to sell)' end,
      case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 20 and av.avg_days_to_sell <= 45
           then 'Average market velocity (' || round(av.avg_days_to_sell) || ' days to sell)' end,
      case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 45
           then 'Slow-moving inventory (' || round(av.avg_days_to_sell) || ' days to sell)' end,
      case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null
           and av.market_day_supply <= 30 then 'Low market day supply (high demand)' end,
      case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null
           and av.market_day_supply > 60 then 'High market day supply (slow demand)' end
    ], null),

    risk_flags = ARRAY(
      SELECT DISTINCT unnest(
        array_remove(array[
          case when coalesce(av.mileage, 0) > v_max_mileage then 'High mileage' end,
          case when coalesce(av.title_status, '') <> ''
                 and coalesce(av.title_status, '') not ilike '%clean%'
                 and coalesce(av.title_status, '') not ilike '%clear%' then 'Title risk' end,
          case when coalesce(av.estimated_profit, 0) < 0 then 'Negative profit' end,
          case when coalesce(av.estimated_profit, 0) >= 0
               and coalesce(av.estimated_profit, 0) < 1500 then 'Low margin' end,
          case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 'Exceeds recon tolerance' end,
          case when not v_allow_salvage
               and coalesce(av.title_status, '') ilike '%salvage%' then 'Salvage title not allowed' end,
          case when av.cr_score is not null and v_min_cr > 0
               and av.cr_score < v_min_cr then 'CR below minimum' end,
          case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null
               and av.avg_days_to_sell > 60
               then 'Slow mover (>' || round(av.avg_days_to_sell) || ' days avg)' end,
          case when coalesce(av.condition_notes, '') ilike '%tmu%'
                  OR 'TMU' = ANY(coalesce(av.risk_flags, '{}'::text[]))
               then 'TMU' end,
          -- Announcement-based flags derived from condition_notes
          case when coalesce(av.condition_notes, '') ilike '%major engine defect%'
               then 'Engine issue' end,
          case when coalesce(av.condition_notes, '') ilike '%major transmission defect%'
               then 'Transmission issue' end,
          case when coalesce(av.condition_notes, '') ilike '%structural damage%'
               then 'Structural' end,
          case when coalesce(av.condition_notes, '') ilike '%structural damage%'
                and (coalesce(av.condition_notes, '') ilike '%rust%'
                     or coalesce(av.condition_notes, '') ilike '%perforated%')
               then 'Frame damage' end,
          case when coalesce(av.condition_notes, '') ilike '%rebuilt history%'
                or coalesce(av.condition_notes, '') ilike '%rebuilt title%'
               then 'Rebuilt' end,
          case when coalesce(av.condition_notes, '') ilike '%total loss%'
               then 'Salvage' end,
          case when coalesce(av.condition_notes, '') ilike '%title absent%'
                or (coalesce(av.condition_notes, '') ilike '%repo%'
                    and coalesce(av.condition_notes, '') not ilike '%report%')
               then 'Title risk' end,
          case when coalesce(av.condition_notes, '') ilike '%hail damage%'
               then 'Accident history' end
        ], null) || COALESCE(av.risk_flags, '{}'::text[])
      )
    ),

    ai_summary = case
      when coalesce(av.estimated_profit, 0) < 0 then
        'Negative estimated profit — this vehicle would lose money at current valuations.'
      when coalesce(av.title_status, '') not ilike '%salvage%'
       and coalesce(av.title_status, '') not ilike '%rebuilt%' then
        case
          when (lower(coalesce(av.damage_type, '')) like '%airbag%'
             or lower(coalesce(av.damage_location, '')) like '%airbag%'
             or lower(coalesce(av.body_condition, '')) like '%deployed%'
             or 'Airbags Deployed' = any(coalesce(av.risk_flags, '{}'::text[])))
          then 'Deployed airbags detected. Recommendation capped — verify airbag replacement cost before bidding.'
          when coalesce(av.profit_score, 0) >= 85
           and coalesce(av.estimated_profit, 0) >= 4000
           and coalesce(av.recommended_max_bid, 0) >= 1000
          then 'Strong margin opportunity matching your dealership preferences.'
          when coalesce(av.profit_score, 0) >= 70 and coalesce(av.estimated_profit, 0) > 1500
          then 'Solid candidate aligned with your buying strategy.'
          when coalesce(av.profit_score, 0) >= 50 and coalesce(av.estimated_profit, 0) > 0
          then 'Worth reviewing, but does not fully match your preferred buying criteria.'
          else 'Does not align with your dealership buying strategy.'
        end
      else
        case
          when coalesce(av.profit_score, 0) >= 80 and coalesce(av.estimated_profit, 0) > 15000
          then 'Strong margin on salvage title — confirm title transfer process before bidding.'
          when coalesce(av.profit_score, 0) >= 65 and coalesce(av.estimated_profit, 0) > 7000
          then 'Good margin on salvage title. Factor title conversion cost into your bid.'
          when coalesce(av.profit_score, 0) >= 50 and coalesce(av.estimated_profit, 0) > 3000
          then 'Marginal salvage opportunity. Verify title path and confirm margin covers conversion cost.'
          else 'Salvage title outside your preference and margin is insufficient to justify the risk.'
        end
    end

  where av.run_list_id = p_run_list_id;

end;
$function$;

ALTER FUNCTION public.apply_vehicle_scoring(uuid) SET statement_timeout = '120s';


-- ─── 3. apply_recommendation_from_score ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_recommendation_from_score(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  UPDATE public.auction_vehicles av
  SET ai_recommendation = CASE

    -- ADESA / no-price rows: profit based on segment estimates.
    -- Thresholds are higher than real-data rows to reflect estimation uncertainty.
    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
     AND coalesce(av.profit_score, 0)     >= 85
     AND coalesce(av.estimated_profit, 0) >= 5000
    THEN 'Strong Buy'

    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
     AND coalesce(av.profit_score, 0)     >= 70
     AND coalesce(av.estimated_profit, 0) >= 2500
    THEN 'Buy'

    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
     AND coalesce(av.estimated_profit, 0) > 0
     AND coalesce(av.profit_score, 0)     >= 50
    THEN 'Possible Buy'

    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
    THEN 'Review'

    WHEN (extract(year from current_date)::int - COALESCE(av.year, extract(year from current_date)::int)) >= 15
     AND COALESCE(av.mileage, 0)            >= 150000
     AND COALESCE(av.title_status, '')      ILIKE '%salvage%'
    THEN 'Pass'

    WHEN coalesce(av.estimated_profit, 0) < 0 THEN 'Pass'

    WHEN coalesce(av.mileage, 0)             >= 200000
     AND coalesce(av.estimated_profit, 0)    >= 3000
     AND coalesce(av.recommended_max_bid, 0) >= 1000
    THEN 'Possible Buy'

    WHEN coalesce(av.mileage, 0) >= 200000
    THEN 'Pass'

    WHEN coalesce(av.title_status, '') ILIKE '%non-repairable%'
      OR coalesce(av.title_status, '') ILIKE '%total%'
    THEN 'Pass'

    WHEN coalesce(av.title_status, '') NOT ILIKE '%salvage%'
     AND coalesce(av.title_status, '') NOT ILIKE '%rebuilt%'
     AND coalesce(av.title_status, '') NOT ILIKE '%non-repairable%'
    THEN CASE
      WHEN (lower(coalesce(av.damage_type,     '')) LIKE '%airbag%'
         OR lower(coalesce(av.damage_location, '')) LIKE '%airbag%'
         OR lower(coalesce(av.body_condition,  '')) LIKE '%deployed%'
         OR 'Airbags Deployed' = ANY(coalesce(av.risk_flags, '{}'::text[])))
      THEN CASE
        WHEN coalesce(av.profit_score, 0)        >= 50
         AND coalesce(av.estimated_profit, 0)    >= 1000
         AND coalesce(av.recommended_max_bid, 0) >= 1000
        THEN 'Possible Buy' ELSE 'Pass'
      END

      WHEN coalesce(av.profit_score, 0)        >= 85
       AND coalesce(av.estimated_profit, 0)    >= 4000
       AND coalesce(av.recommended_max_bid, 0) >= 1000
       AND NOT ('Exceeds recon tolerance' = ANY(coalesce(av.risk_flags, '{}'::text[])))
      THEN 'Strong Buy'

      WHEN coalesce(av.profit_score, 0)        >= 70
       AND coalesce(av.estimated_profit, 0)    >= 1500
       AND coalesce(av.recommended_max_bid, 0) >= 1500
      THEN 'Buy'

      WHEN coalesce(av.profit_score, 0)        >= 50
       AND coalesce(av.estimated_profit, 0)    >= 1000
       AND coalesce(av.recommended_max_bid, 0) >= 1000
       AND coalesce(av.mileage, 0)             <  200000
      THEN 'Possible Buy'

      ELSE 'Pass'
    END

    ELSE CASE
      WHEN coalesce(av.profit_score, 0) >= 80
       AND coalesce(av.estimated_profit, 0) > 15000 THEN 'Strong Buy'
      WHEN coalesce(av.profit_score, 0) >= 65
       AND coalesce(av.estimated_profit, 0) >  7000 THEN 'Buy'
      WHEN coalesce(av.profit_score, 0)        >= 50
       AND coalesce(av.estimated_profit, 0)    >  3000
       AND coalesce(av.recommended_max_bid, 0) >= 1000 THEN 'Possible Buy'
      ELSE 'Pass'
    END

  END
  WHERE av.run_list_id = p_run_list_id
    AND COALESCE(av.ai_recommendation, '') != 'Pass';

end;
$function$;

ALTER FUNCTION public.apply_recommendation_from_score(uuid) SET statement_timeout = '120s';


-- ─── 4. apply_hard_preference_filters ────────────────────────────────────────

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
    v_excluded_brands  := COALESCE(v_override.excluded_brands, '{}');
    v_vehicle_types    := COALESCE(v_override.vehicle_types, '{}');
    v_min_price        := COALESCE(v_override.min_price, 0);
    v_max_price        := COALESCE(v_override.max_price, 0);
    v_min_year         := COALESCE(v_override.min_year, 0);
    v_max_year         := COALESCE(v_override.max_year, 9999);
    v_min_mileage      := COALESCE(v_override.min_mileage, 0);
    v_max_mileage      := COALESCE(v_override.max_mileage, 0);
    v_min_cr           := COALESCE(v_override.min_cr_score, 0);
    v_allow_no_cr      := COALESCE(v_override.allow_no_cr, true);
    v_allow_salvage    := COALESCE(v_override.allow_salvage, false);
    v_allow_frame      := COALESCE(v_override.allow_frame_damage, false);
    v_allow_tmu        := COALESCE(v_override.allow_tmu, true);
    v_max_recon        := COALESCE(v_override.max_recon_cost, 0);
  ELSE
    SELECT * INTO v_prefs FROM public.dealer_preferences WHERE organization_id = v_org_id LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;

    v_preferred_brands := COALESCE(v_prefs.preferred_brands, '{}');
    v_excluded_brands  := COALESCE(v_prefs.excluded_brands, '{}');
    v_vehicle_types    := COALESCE(v_prefs.vehicle_types, '{}');
    v_min_price        := COALESCE(v_prefs.min_price, 0);
    v_max_price        := COALESCE(v_prefs.max_price, 0);
    v_min_year         := COALESCE(v_prefs.min_year, 0);
    v_max_year         := COALESCE(v_prefs.max_year, 9999);
    v_min_mileage      := COALESCE(v_prefs.min_mileage, 0);
    v_max_mileage      := COALESCE(v_prefs.max_mileage, 300000);
    v_min_cr           := COALESCE(v_prefs.min_cr_score, 0);
    v_allow_no_cr      := COALESCE(v_prefs.allow_no_cr, true);
    v_allow_salvage    := COALESCE(v_prefs.allow_salvage, false);
    v_allow_frame      := COALESCE(v_prefs.allow_frame_damage, false);
    v_allow_tmu        := COALESCE(v_prefs.allow_tmu, true);
    v_max_recon        := COALESCE(v_prefs.max_recon_cost, 0);
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
          AND CASE
            WHEN av.lot_number IS NOT NULL AND (av.title_status IS NOT NULL OR av.damage_location IS NOT NULL)
            THEN COALESCE(av.buy_now, av.current_bid, 0)
            ELSE COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
          END > v_max_price
          AND CASE
            WHEN av.lot_number IS NOT NULL AND (av.title_status IS NOT NULL OR av.damage_location IS NOT NULL)
            THEN COALESCE(av.buy_now, av.current_bid, 0) > 0
            ELSE COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > 0
          END)
      OR (v_min_price > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) > 0
          AND COALESCE(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) < v_min_price)
      OR (v_min_year > 0 AND av.year IS NOT NULL AND av.year < v_min_year)
      OR (v_max_year < 9999 AND av.year IS NOT NULL AND av.year > v_max_year)
      OR (v_max_mileage > 0 AND av.mileage IS NOT NULL AND av.mileage > v_max_mileage)
      OR (v_min_mileage > 0 AND av.mileage IS NOT NULL AND av.mileage < v_min_mileage)
      OR (av.cr_score IS NOT NULL AND v_min_cr > 0 AND av.cr_score < v_min_cr)
     OR (av.cr_score IS NULL AND NOT v_allow_no_cr
    AND NOT (av.lot_number IS NOT NULL AND (
      av.title_status IS NOT NULL OR av.damage_location IS NOT NULL OR
      av.damage_type  IS NOT NULL OR av.drive_condition IS NOT NULL
    ))
    AND NOT (
      av.buy_now IS NULL AND av.mmr_value IS NULL AND
      av.price_estimate IS NULL AND av.current_bid IS NULL
    ))
      OR (COALESCE(av.title_status, '') ILIKE '%non-repairable%'
          OR COALESCE(av.title_status, '') ILIKE '%certificate of destruction%')
      OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[])))
      OR (NOT v_allow_tmu AND (COALESCE(av.title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
      OR (v_max_recon > 0
          AND COALESCE(av.estimated_recon_cost, 0) > v_max_recon
          AND NOT (COALESCE(av.title_status, '') ILIKE '%salvage%'))
    );
END;
$function$;

ALTER FUNCTION public.apply_hard_preference_filters(uuid) SET statement_timeout = '120s';


-- ─── 5. infer_vehicle_types — add Excursion (SUV) and Crown Victoria (Sedan) ──

CREATE OR REPLACE FUNCTION public.infer_vehicle_types(p_run_list_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_suv_models text[] := ARRAY[
    'CR-V','CRV','RAV4','HIGHLANDER','4RUNNER','PILOT','PASSPORT','HR-V','HRV',
    'TUCSON','SANTA FE','PALISADE','KONA','VENUE','IONIQ 5','IONIQ 6',
    'SORENTO','TELLURIDE','SPORTAGE','SELTOS','NIRO','EV6','EV9',
    'EQUINOX','BLAZER','TRAVERSE','TAHOE','SUBURBAN','AVALANCHE','TRAILBLAZER','TRAX','BOLT',
    'ESCAPE','EXPLORER','EXPEDITION','BRONCO','BRONCO SPORT','EDGE','EXCURSION',
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
    'NV200','NV','SPRINTER','RAM VAN','EXPRESS VAN','SAVANA'
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
    'MAZDA3','CHARGER','SOUL','MIRAGE',
    'CROWN VICTORIA','CROWN VIC','TOWN CAR','GRAND MARQUIS'
  ];
BEGIN
  UPDATE public.auction_vehicles av
  SET vehicle_type =
    CASE
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_truck_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Truck'
      WHEN upper(COALESCE(av.make, '')) = 'RAM'
       AND upper(COALESCE(av.model, '')) NOT LIKE '%VAN%' THEN 'Truck'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_van_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Van'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_suv_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'SUV'
      WHEN upper(COALESCE(av.model, '')) LIKE '%1500%'
        OR upper(COALESCE(av.model, '')) LIKE '%2500%'
        OR upper(COALESCE(av.model, '')) LIKE '%3500%'
      THEN 'Truck'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_coupe_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Coupe'
      WHEN EXISTS (
        SELECT 1 FROM unnest(v_sedan_models) AS m
        WHERE upper(COALESCE(av.model, '')) = m
          OR upper(COALESCE(av.model, '')) LIKE m || ' %'
      ) THEN 'Sedan'
      ELSE 'Other'
    END
  WHERE av.run_list_id = p_run_list_id
    AND (av.vehicle_type IS NULL OR av.vehicle_type = '' OR av.vehicle_type = 'Other');
END;
$function$;
