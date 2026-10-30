-- Create the missing lane_strategy_view
CREATE OR REPLACE VIEW public.lane_strategy_view AS
SELECT 
  bmi.bidding_map_id,
  bmi.auction_vehicle_id,
  bmi.lane,
  bmi.run_order,
  bm.name AS lane_strategy_name,
  av.run_list_id,
  av.year,
  av.make,
  av.model,
  av.trim,
  av.mileage,
  av.recommended_max_bid,
  av.estimated_profit,
  av.profit_score,
  av.ai_recommendation,
  av.risk_flags,
  av.scoring_reasons,
  av.ai_summary
FROM public.bidding_map_items bmi
JOIN public.bidding_maps bm ON bmi.bidding_map_id = bm.id
JOIN public.auction_vehicles av ON bmi.auction_vehicle_id = av.id;
