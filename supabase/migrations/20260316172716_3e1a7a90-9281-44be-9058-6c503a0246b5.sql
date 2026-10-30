CREATE OR REPLACE FUNCTION public.generate_buy_list_from_profit(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin

insert into public.buy_list_items (
  buy_list_id,
  auction_vehicle_id,
  custom_max_bid,
  dealer_notes
)

select
  bl.id,
  av.id,
  av.recommended_max_bid,
  'Auto-selected by LogicLot Profit Engine'
from public.auction_vehicles av
join public.buy_lists bl
  on bl.run_list_id = av.run_list_id
where av.run_list_id = p_run_list_id
and av.ai_recommendation in ('Strong Buy', 'Buy')
order by av.estimated_profit desc
limit 50;

end;
$function$;