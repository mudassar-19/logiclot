
-- Replace calculate_run_list_profit_engine with intelligent recon + realistic profit model
CREATE OR REPLACE FUNCTION public.calculate_run_list_profit_engine(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_target_profit numeric;
  v_has_target boolean;
begin
  select dp.target_profit
  into v_target_profit
  from public.dealer_preferences dp
  join public.auction_run_lists rl
    on rl.organization_id = dp.organization_id
  where rl.id = p_run_list_id
  limit 1;

  v_has_target := coalesce(v_target_profit, 0) > 0;
  if not v_has_target then
    v_target_profit := 0;
  end if;

  -- Step 1: Smart recon estimation based on CR, age, mileage, body type, make
  update public.auction_vehicles av
  set estimated_recon_cost = greatest(400, least(8000,
    round((
      -- Base recon by CR score bands
      (case
        when av.cr_score is null then 1800
        when av.cr_score >= 4.0 then 600
        when av.cr_score >= 3.5 then 900
        when av.cr_score >= 3.0 then 1400
        when av.cr_score >= 2.5 then 2200
        when av.cr_score >= 2.0 then 3200
        else 4500
      end)
      -- Age adjustment: +$150 per year over 5 years old
      + greatest(0, (extract(year from current_date)::int - coalesce(av.year, 2020) - 5)) * 150
      -- Mileage adjustment: +$200 per 25k miles over 75k
      + greatest(0, (coalesce(av.mileage, 0) - 75000)::numeric) / 25000.0 * 200
    )
    -- Body type multiplier
    * (case
        when coalesce(av.vehicle_type, 'Other') = 'Truck' then 1.15
        when coalesce(av.vehicle_type, 'Other') = 'SUV' then 1.10
        when coalesce(av.vehicle_type, 'Other') = 'Van' then 1.20
        when coalesce(av.vehicle_type, 'Other') = 'Coupe' then 1.05
        else 1.0
      end)
    -- Luxury make multiplier
    * (case
        when upper(coalesce(av.make, '')) in ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LEXUS','PORSCHE','LAND ROVER','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','GENESIS','INFINITI','ACURA','VOLVO','ALFA ROMEO','LINCOLN','CADILLAC') then 1.30
        else 1.0
      end)
    )
  ))
  where av.run_list_id = p_run_list_id;

  -- Step 2: Set transport and auction fees
  update public.auction_vehicles av
  set
    estimated_transport_cost = coalesce(av.estimated_transport_cost, 350),
    estimated_auction_fee = coalesce(av.estimated_auction_fee, 500)
  where av.run_list_id = p_run_list_id;

  -- Step 3: Calculate retail value with tiered markup
  update public.auction_vehicles av
  set estimated_retail_value =
    case
      when coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) <= 10000 then
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.25
      when coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) <= 25000 then
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.20
      when coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) <= 50000 then
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.15
      else
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0) * 1.12
    end
  where av.run_list_id = p_run_list_id;

  -- Step 4: Calculate profit = retail - acquisition - recon - transport - auction fee
  update public.auction_vehicles av
  set
    recommended_max_bid =
      case when not v_has_target then
        coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
      else
        av.estimated_retail_value
        - v_target_profit
        - coalesce(av.estimated_recon_cost, 1500)
        - coalesce(av.estimated_transport_cost, 350)
        - coalesce(av.estimated_auction_fee, 500)
      end,

    total_estimated_cost =
      coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
      + coalesce(av.estimated_recon_cost, 1500)
      + coalesce(av.estimated_transport_cost, 350)
      + coalesce(av.estimated_auction_fee, 500),

    estimated_profit =
      av.estimated_retail_value
      - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
      - coalesce(av.estimated_recon_cost, 1500)
      - coalesce(av.estimated_transport_cost, 350)
      - coalesce(av.estimated_auction_fee, 500),

    profit_score =
      case
        when (av.estimated_retail_value
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1500)
              - coalesce(av.estimated_transport_cost, 350)
              - coalesce(av.estimated_auction_fee, 500)) >= 3000 then 100
        when (av.estimated_retail_value
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1500)
              - coalesce(av.estimated_transport_cost, 350)
              - coalesce(av.estimated_auction_fee, 500)) >= 1500 then 85
        when (av.estimated_retail_value
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1500)
              - coalesce(av.estimated_transport_cost, 350)
              - coalesce(av.estimated_auction_fee, 500)) >= 500 then 70
        when (av.estimated_retail_value
              - coalesce(av.buy_now, av.mmr_value, av.price_estimate, av.current_bid, 0)
              - coalesce(av.estimated_recon_cost, 1500)
              - coalesce(av.estimated_transport_cost, 350)
              - coalesce(av.estimated_auction_fee, 500)) >= 0 then 50
        else 25
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;
