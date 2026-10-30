-- Recreate add_vehicles_to_bid_map to return boolean
DROP FUNCTION IF EXISTS public.add_vehicles_to_bid_map(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.add_vehicles_to_bid_map(
  p_bidding_map_id uuid,
  p_vehicle_ids uuid[]
)
 RETURNS boolean
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
  
  return true;
end;
$function$;
