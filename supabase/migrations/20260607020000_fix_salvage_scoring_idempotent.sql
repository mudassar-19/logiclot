-- Fix: apply_vehicle_scoring compounds deductions on repeated runs and gives
-- identical 'Pass' recommendations to all salvage vehicles regardless of profit.
--
-- Root causes:
--   1. The function reads av.profit_score (the value it last wrote) as its base.
--      Each run subtracts the salvage/recon penalties again, driving the score to 0.
--   2. The flat -50 salvage penalty maps any base score (≤100) to ≤50 after the -15
--      recon penalty → always 'Pass' for IAA salvage (which always exceeds max_recon
--      due to the $4,000 r_risk component).
--   3. apply_hard_preference_filters also force-sets ai_recommendation='Pass' for
--      every salvage vehicle, overwriting whatever scoring produced.
--
-- Fixes:
--   1. Derive the base score fresh from estimated_profit ratios on every run.
--      This mirrors the profit engine's own scoring tier and is idempotent.
--   2. Tiered salvage penalty scaled to profit magnitude:
--        profit ≥ $20k → -5   (surfaces as 'Buy' if margin is ≥20% ERV)
--        profit ≥ $10k → -15  (surfaces as 'Buy'/'Possible Buy')
--        profit ≥  $5k → -25
--        profit ≥  $3k → -35
--        else          → -50  (hard pass — title risk exceeds thin margin)
--   3. Remove salvage from apply_hard_preference_filters' hard ai_recommendation
--      override. generate_buy_list_from_profit already gates the buy list on
--      (v_allow_salvage OR NOT title_status ILIKE '%salvage%'), so salvage vehicles
--      never enter the buy list regardless of their ai_recommendation. Keeping the
--      override in the hard filter prevented high-profit salvage from surfacing
--      as 'Buy' in the run-list view, which was misleading to dealers.

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
  join public.auction_run_lists rl
    on rl.organization_id = dp.organization_id
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

  update public.auction_vehicles av
  set
    scoring_reasons = array_remove(array[
      case when av.profit_score >= 100 then 'Meets target profit' end,
      case when av.profit_score >= 75 and av.profit_score < 100 then 'Strong projected margin' end,
      case when av.profit_score >= 50 and av.profit_score < 75 then 'Moderate projected margin' end,
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
      case when av.cr_score is not null
           and av.cr_score >= v_min_cr then 'CR score meets minimum' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell <= 20 then 'Fast-moving inventory (< 20 days to sell)' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 20 and av.avg_days_to_sell <= 45 then 'Average market velocity (' || round(av.avg_days_to_sell) || ' days to sell)' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 45 then 'Slow-moving inventory (' || round(av.avg_days_to_sell) || ' days to sell)' end,
      case when v_focus_on in ('mds', 'both')
           and av.market_day_supply is not null
           and av.market_day_supply <= 30 then 'Low market day supply (high demand)' end,
      case when v_focus_on in ('mds', 'both')
           and av.market_day_supply is not null
           and av.market_day_supply > 60 then 'High market day supply (slow demand)' end
    ], null),

    risk_flags = array_remove(array[
      case when coalesce(av.mileage, 0) > v_max_mileage then 'High mileage' end,
      case when coalesce(av.title_status, '') <> ''
             and coalesce(av.title_status, '') not ilike '%clean%'
             and coalesce(av.title_status, '') not ilike '%clear%' then 'Title risk' end,
      case when coalesce(av.estimated_profit, 0) < 0 then 'Negative profit' end,
      case when coalesce(av.estimated_profit, 0) >= 0 and coalesce(av.estimated_profit, 0) < 1500 then 'Low margin' end,
      case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 'Exceeds recon tolerance' end,
      case when not v_allow_salvage
           and coalesce(av.title_status, '') ilike '%salvage%' then 'Salvage title not allowed' end,
      case when av.cr_score is not null
           and v_min_cr > 0
           and av.cr_score < v_min_cr then 'CR below minimum' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 60 then 'Slow mover (>' || round(av.avg_days_to_sell) || ' days avg)' end
    ], null),

    profit_score = greatest(0, least(100,
      -- Base: re-derived from profit engine ratios on every call — idempotent
      -- regardless of how many times this function has previously run.
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
      -- Tiered salvage penalty: flat -50 mapped everything to 'Pass'.
      -- Now scales with profit so high-margin salvage surfaces as 'Buy'.
      -- generate_buy_list_from_profit still gates actual buy list insertion on
      -- (v_allow_salvage OR NOT title_status ILIKE '%salvage%') independently.
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
      - case when av.cr_score is not null
             and v_min_cr > 0
             and av.cr_score < v_min_cr then 25 else 0 end
      - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
      - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
      - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
    )),

    ai_recommendation =
      case
        when coalesce(av.estimated_profit, 0) < 0 then 'Pass'
        when greatest(0, least(100,
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
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
          + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then
              case when coalesce(av.estimated_profit, 0) >= 20000 then 5 when coalesce(av.estimated_profit, 0) >= 10000 then 15 when coalesce(av.estimated_profit, 0) >= 5000 then 25 when coalesce(av.estimated_profit, 0) >= 3000 then 35 else 50 end
            else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 85 then 'Strong Buy'
        when greatest(0, least(100,
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
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
          + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then
              case when coalesce(av.estimated_profit, 0) >= 20000 then 5 when coalesce(av.estimated_profit, 0) >= 10000 then 15 when coalesce(av.estimated_profit, 0) >= 5000 then 25 when coalesce(av.estimated_profit, 0) >= 3000 then 35 else 50 end
            else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 70 then 'Buy'
        when greatest(0, least(100,
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
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
          + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then
              case when coalesce(av.estimated_profit, 0) >= 20000 then 5 when coalesce(av.estimated_profit, 0) >= 10000 then 15 when coalesce(av.estimated_profit, 0) >= 5000 then 25 when coalesce(av.estimated_profit, 0) >= 3000 then 35 else 50 end
            else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 50 then 'Possible Buy'
        else 'Pass'
      end,

    ai_summary =
      case
        when coalesce(av.estimated_profit, 0) < 0 then
          'Negative estimated profit — this vehicle would lose money at current valuations.'
        when greatest(0, least(100,
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
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
          + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then
              case when coalesce(av.estimated_profit, 0) >= 20000 then 5 when coalesce(av.estimated_profit, 0) >= 10000 then 15 when coalesce(av.estimated_profit, 0) >= 5000 then 25 when coalesce(av.estimated_profit, 0) >= 3000 then 35 else 50 end
            else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 85 then
          case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%'
            then 'Strong margin on salvage title — confirm title transfer process before bidding.'
            else 'Strong margin opportunity matching your dealership preferences.'
          end
        when greatest(0, least(100,
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
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
          + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then
              case when coalesce(av.estimated_profit, 0) >= 20000 then 5 when coalesce(av.estimated_profit, 0) >= 10000 then 15 when coalesce(av.estimated_profit, 0) >= 5000 then 25 when coalesce(av.estimated_profit, 0) >= 3000 then 35 else 50 end
            else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 70 then
          case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%'
            then 'Good margin on salvage title. Factor title conversion cost into your bid.'
            else 'Solid candidate aligned with your buying strategy.'
          end
        when greatest(0, least(100,
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
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
          + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then
              case when coalesce(av.estimated_profit, 0) >= 20000 then 5 when coalesce(av.estimated_profit, 0) >= 10000 then 15 when coalesce(av.estimated_profit, 0) >= 5000 then 25 when coalesce(av.estimated_profit, 0) >= 3000 then 35 else 50 end
            else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 50 then
          case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%'
            then 'Marginal salvage opportunity. Verify title path and confirm margin covers conversion cost.'
            else 'Worth reviewing, but does not fully match your preferred buying criteria.'
          end
        else
          case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%'
            then 'Salvage title outside your preference and margin is insufficient to justify the risk.'
            else 'Does not align with your dealership buying strategy.'
          end
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;


-- Fix apply_hard_preference_filters: remove salvage from the hard ai_recommendation override.
--
-- Previously this function force-set ai_recommendation='Pass' for ALL salvage vehicles
-- when allow_salvage=false, AFTER apply_vehicle_scoring had already set a meaningful
-- recommendation based on profit tiering. The override wiped out the scoring result.
--
-- Salvage exclusion from the buy list is enforced in generate_buy_list_from_profit:
--   AND (v_allow_salvage OR NOT COALESCE(av.title_status,'') ILIKE '%salvage%')
-- That check is independent of ai_recommendation, so high-profit salvage vehicles
-- stay out of the auto-generated buy list while still showing a useful recommendation
-- in the run-list view.

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
      OR (av.cr_score IS NULL AND NOT v_allow_no_cr)
      -- Salvage: scoring handles the ai_recommendation via tiered penalty.
      -- Hard filter is removed here so high-profit salvage keeps its 'Buy'/'Possible Buy'
      -- recommendation in the run-list view. Buy list insertion is still gated in
      -- generate_buy_list_from_profit on (v_allow_salvage OR NOT title ILIKE '%salvage%').
      OR (NOT v_allow_frame AND 'Frame damage' = ANY(COALESCE(av.risk_flags, '{}'::text[])))
      OR (NOT v_allow_tmu AND (COALESCE(av.title_status, '') ILIKE '%tmu%' OR 'TMU' = ANY(COALESCE(av.risk_flags, '{}'::text[]))))
      OR (v_max_recon > 0
          AND (COALESCE(av.buy_now, 0) > 0 OR COALESCE(av.price_estimate, 0) > 0 OR COALESCE(av.current_bid, 0) > 0)
          AND COALESCE(av.estimated_recon_cost, 0) > v_max_recon)
    );
END;
$function$;

ALTER FUNCTION public.apply_hard_preference_filters(uuid) SET statement_timeout = '120s';
