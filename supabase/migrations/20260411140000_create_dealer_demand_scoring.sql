-- Create apply_dealer_demand_scoring function
-- Scores vehicles based on how well they match the dealer's preferred brands/models.
-- Writes: dealer_demand_score, demand_score, brand_match, model_match

CREATE OR REPLACE FUNCTION public.apply_dealer_demand_scoring(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_pref_brands text[];
  v_pref_models text[];
begin
  -- Load dealer preferences for the org that owns this run list
  select
    coalesce(dp.preferred_brands, '{}'),
    coalesce(dp.preferred_models, '{}')
  into v_pref_brands, v_pref_models
  from public.dealer_preferences dp
  join public.auction_run_lists rl on rl.organization_id = dp.organization_id
  where rl.id = p_run_list_id
  limit 1;

  -- Defaults if no preferences row found
  if not found then
    v_pref_brands := '{}';
    v_pref_models := '{}';
  end if;

  update public.auction_vehicles av
  set
    brand_match = (
      array_length(v_pref_brands, 1) > 0
      and upper(coalesce(av.make, '')) = any(select upper(b) from unnest(v_pref_brands) as b)
    ),
    model_match = (
      array_length(v_pref_models, 1) > 0
      and upper(coalesce(av.model, '')) = any(select upper(m) from unnest(v_pref_models) as m)
    ),
    dealer_demand_score = (
      case
        when array_length(v_pref_brands, 1) > 0
          and upper(coalesce(av.make, '')) = any(select upper(b) from unnest(v_pref_brands) as b)
          and array_length(v_pref_models, 1) > 0
          and upper(coalesce(av.model, '')) = any(select upper(m) from unnest(v_pref_models) as m)
          then 100
        when array_length(v_pref_brands, 1) > 0
          and upper(coalesce(av.make, '')) = any(select upper(b) from unnest(v_pref_brands) as b)
          then 70
        when array_length(v_pref_models, 1) > 0
          and upper(coalesce(av.model, '')) = any(select upper(m) from unnest(v_pref_models) as m)
          then 50
        else 0
      end
    ),
    demand_score = (
      case
        when array_length(v_pref_brands, 1) > 0
          and upper(coalesce(av.make, '')) = any(select upper(b) from unnest(v_pref_brands) as b)
          and array_length(v_pref_models, 1) > 0
          and upper(coalesce(av.model, '')) = any(select upper(m) from unnest(v_pref_models) as m)
          then 100
        when array_length(v_pref_brands, 1) > 0
          and upper(coalesce(av.make, '')) = any(select upper(b) from unnest(v_pref_brands) as b)
          then 70
        when array_length(v_pref_models, 1) > 0
          and upper(coalesce(av.model, '')) = any(select upper(m) from unnest(v_pref_models) as m)
          then 50
        else 0
      end
    )
  where av.run_list_id = p_run_list_id;
end;
$function$;
