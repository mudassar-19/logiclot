
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
    v_pref_brands := coalesce(v_prefs.preferred_brands, '{}');
    v_pref_models := coalesce(v_prefs.preferred_models, '{}');
    v_min_cr := coalesce(v_prefs.min_cr_score, 0);
    v_max_mileage := coalesce(v_prefs.max_mileage, 999999);
    v_max_recon := coalesce(v_prefs.max_recon_cost, 999999);
    v_allow_salvage := coalesce(v_prefs.allow_salvage, false);
    v_allow_frame := coalesce(v_prefs.allow_frame_damage, false);
  else
    v_pref_brands := '{}';
    v_pref_models := '{}';
    v_min_cr := 0;
    v_max_mileage := 999999;
    v_max_recon := 999999;
    v_allow_salvage := false;
    v_allow_frame := false;
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
      case when coalesce(av.title_status, '') ilike '%clean%' then 'Clean title' end,
      case when coalesce(av.title_status, '') <> '' and coalesce(av.title_status, '') not ilike '%clean%' then 'Title requires review' end,
      case when array_length(v_pref_brands, 1) > 0
           and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 'Preferred brand match' end,
      case when array_length(v_pref_models, 1) > 0
           and upper(av.model) = any(select upper(unnest(v_pref_models))) then 'Preferred model match' end,
      case when av.cr_score is not null
           and av.cr_score >= v_min_cr then 'CR score meets minimum' end
    ], null),

    risk_flags = array_remove(array[
      case when coalesce(av.mileage, 0) > v_max_mileage then 'High mileage' end,
      case when coalesce(av.title_status, '') <> '' and coalesce(av.title_status, '') not ilike '%clean%' then 'Title risk' end,
      case when coalesce(av.estimated_profit, 0) < 0 then 'Negative profit' end,
      case when coalesce(av.estimated_profit, 0) >= 0 and coalesce(av.estimated_profit, 0) < 1500 then 'Low margin' end,
      case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 'Exceeds recon tolerance' end,
      case when not v_allow_salvage
           and coalesce(av.title_status, '') ilike '%salvage%' then 'Salvage title not allowed' end,
      case when av.cr_score is not null
           and v_min_cr > 0
           and av.cr_score < v_min_cr then 'CR below minimum' end
    ], null),

    profit_score = greatest(0, least(100,
      av.profit_score
      + case when array_length(v_pref_brands, 1) > 0
             and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
      + case when array_length(v_pref_models, 1) > 0
             and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
      + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
      - case when not v_allow_salvage
             and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
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
          av.profit_score
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 85 then 'Strong Buy'
        when greatest(0, least(100,
          av.profit_score
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 70 then 'Buy'
        when greatest(0, least(100,
          av.profit_score
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 50 then 'Possible Buy'
        else 'Pass'
      end,

    ai_summary =
      case
        when coalesce(av.estimated_profit, 0) < 0 then 'Negative estimated profit — this vehicle would lose money at current valuations.'
        when greatest(0, least(100,
          av.profit_score
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 85 then 'Strong margin opportunity matching your dealership preferences.'
        when greatest(0, least(100,
          av.profit_score
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 70 then 'Solid candidate aligned with your buying strategy.'
        when greatest(0, least(100,
          av.profit_score
          + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
          + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
          + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
          - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
          - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
          - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
          - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
          - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
        )) >= 50 then 'Worth reviewing, but does not fully match your preferred buying criteria.'
        else 'Does not align with your dealership buying strategy.'
      end
  where av.run_list_id = p_run_list_id
    AND av.ai_recommendation != 'Pass';
end;
$function$
