-- Override apply_vehicle_scoring to ensure risk_flags are computed idempotently.
-- This filters out old dynamically-calculated risk flags before appending the new ones,
-- preventing stale flags (like 'Negative profit' or 'Low margin') from persisting when values change.

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
        ], null) || ARRAY(
          SELECT x 
          FROM unnest(COALESCE(av.risk_flags, '{}'::text[])) x 
          WHERE x NOT IN ('High mileage', 'Title risk', 'Negative profit', 'Low margin', 'Exceeds recon tolerance', 'Salvage title not allowed', 'CR below minimum')
            AND x NOT LIKE 'Slow mover%'
        )
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
