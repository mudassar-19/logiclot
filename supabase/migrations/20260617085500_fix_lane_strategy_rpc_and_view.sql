-- Add purchase_price to bidding_map_items
ALTER TABLE public.bidding_map_items 
  ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT NULL;

-- Function: add_vehicles_to_bid_map
CREATE OR REPLACE FUNCTION public.add_vehicles_to_bid_map(
  p_bidding_map_id uuid,
  p_vehicle_ids uuid[]
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.bidding_map_items (bidding_map_id, auction_vehicle_id, lane, run_order, recommended_bid)
  select 
    p_bidding_map_id, 
    av.id,
    av.lane,
    av.run_order,
    av.recommended_max_bid
  from public.auction_vehicles av
  where av.id = any(p_vehicle_ids)
  on conflict (bidding_map_id, auction_vehicle_id) do nothing;
end;
$function$;

-- Function: mark_vehicle_passed
CREATE OR REPLACE FUNCTION public.mark_vehicle_passed(
  p_bidding_map_item_id uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update public.bidding_map_items
  set outcome = 'passed'
  where id = p_bidding_map_item_id;
end;
$function$;

-- Function: mark_vehicle_purchased
CREATE OR REPLACE FUNCTION public.mark_vehicle_purchased(
  p_bidding_map_item_id uuid,
  p_purchase_price numeric DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update public.bidding_map_items
  set outcome = 'purchased',
      purchase_price = p_purchase_price
  where id = p_bidding_map_item_id;
end;
$function$;

-- Function: start_auction_intelligence
CREATE OR REPLACE FUNCTION public.start_auction_intelligence(
  p_bidding_map_id uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update public.bidding_maps
  set intelligence_status = 'live',
      current_vehicle_index = 0
  where id = p_bidding_map_id;
end;
$function$;

-- View: auction_performance_report
CREATE OR REPLACE VIEW public.auction_performance_report AS
SELECT 
  bm.id AS bidding_map_id,
  bm.name AS lane_strategy_name,
  bm.created_at AS auction_started_at,
  bm.intelligence_status AS auction_status,
  COUNT(bmi.id) AS total_selected_units,
  COUNT(CASE WHEN bmi.outcome = 'purchased' THEN 1 END) AS purchased_units,
  COUNT(CASE WHEN bmi.outcome = 'passed' THEN 1 END) AS passed_units,
  COALESCE(SUM(bmi.purchase_price), 0) AS total_purchase_spend,
  COALESCE(SUM(CASE WHEN bmi.outcome = 'purchased' THEN av.estimated_profit END), 0) AS projected_profit_on_purchased_units,
  COALESCE(AVG(CASE WHEN bmi.outcome = 'purchased' THEN av.profit_score END), 0) AS avg_profit_score_purchased
FROM public.bidding_maps bm
LEFT JOIN public.bidding_map_items bmi ON bmi.bidding_map_id = bm.id
LEFT JOIN public.auction_vehicles av ON bmi.auction_vehicle_id = av.id
GROUP BY bm.id, bm.name, bm.created_at, bm.intelligence_status;
