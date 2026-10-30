
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
      (case
        when av.cr_score is null then 1800
        when av.cr_score >= 4.0 then 600
        when av.cr_score >= 3.5 then 900
        when av.cr_score >= 3.0 then 1400
        when av.cr_score >= 2.5 then 2200
        when av.cr_score >= 2.0 then 3200
        else 4500
      end)
      + greatest(0, (extract(year from current_date)::int - coalesce(av.year, 2020) - 5)) * 150
      + greatest(0, (coalesce(av.mileage, 0) - 75000)::numeric) / 25000.0 * 200
    )
    * (case
        when coalesce(av.vehicle_type, 'Other') = 'Truck' then 1.15
        when coalesce(av.vehicle_type, 'Other') = 'SUV' then 1.10
        when coalesce(av.vehicle_type, 'Other') = 'Van' then 1.20
        when coalesce(av.vehicle_type, 'Other') = 'Coupe' then 1.05
        else 1.0
      end)
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

  -- Step 3: Estimate retail value INDEPENDENTLY from acquisition
  -- Retail = wholesale reference x retail multiplier by price tier
  -- Wholesale ref is best available market value (MMR preferred)
  update public.auction_vehicles av
  set estimated_retail_value =
    round(
      coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
      * (case
          when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) <= 8000 then 1.35
          when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) <= 15000 then 1.28
          when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) <= 25000 then 1.22
          when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) <= 40000 then 1.18
          else 1.14
        end)
    )
  where av.run_list_id = p_run_list_id;

  -- Step 4: Max Bid = Retail - TargetMargin - Recon - Fees
  -- If target profit set use it as dollar amount; otherwise use 15% of retail
  -- Profit = Retail - Acquisition(wholesale) - Recon - Fees
  -- Classification by margin %: Strong Buy 20%+, Buy 15-20%, Maybe 10-15%
  update public.auction_vehicles av
  set
    recommended_max_bid =
      round(
        av.estimated_retail_value
        - (case
            when v_has_target then v_target_profit
            else av.estimated_retail_value * 0.15
          end)
        - coalesce(av.estimated_recon_cost, 1500)
        - coalesce(av.estimated_transport_cost, 350)
        - coalesce(av.estimated_auction_fee, 500)
      ),

    total_estimated_cost =
      coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
      + coalesce(av.estimated_recon_cost, 1500)
      + coalesce(av.estimated_transport_cost, 350)
      + coalesce(av.estimated_auction_fee, 500),

    estimated_profit =
      round(
        av.estimated_retail_value
        - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
        - coalesce(av.estimated_recon_cost, 1500)
        - coalesce(av.estimated_transport_cost, 350)
        - coalesce(av.estimated_auction_fee, 500)
      ),

    profit_score =
      case
        when av.estimated_retail_value <= 0 then 0
        when v_has_target then
          case
            when (av.estimated_retail_value
                  - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                  - coalesce(av.estimated_recon_cost, 1500)
                  - coalesce(av.estimated_transport_cost, 350)
                  - coalesce(av.estimated_auction_fee, 500)) >= v_target_profit then 100
            when (av.estimated_retail_value
                  - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                  - coalesce(av.estimated_recon_cost, 1500)
                  - coalesce(av.estimated_transport_cost, 350)
                  - coalesce(av.estimated_auction_fee, 500)) >= v_target_profit * 0.80 then 85
            when (av.estimated_retail_value
                  - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                  - coalesce(av.estimated_recon_cost, 1500)
                  - coalesce(av.estimated_transport_cost, 350)
                  - coalesce(av.estimated_auction_fee, 500)) >= v_target_profit * 0.60 then 70
            when (av.estimated_retail_value
                  - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                  - coalesce(av.estimated_recon_cost, 1500)
                  - coalesce(av.estimated_transport_cost, 350)
                  - coalesce(av.estimated_auction_fee, 500)) >= 0 then 50
            else 25
          end
        else
          case
            when ((av.estimated_retail_value
                   - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                   - coalesce(av.estimated_recon_cost, 1500)
                   - coalesce(av.estimated_transport_cost, 350)
                   - coalesce(av.estimated_auction_fee, 500))::numeric
                  / nullif(av.estimated_retail_value, 0)) >= 0.20 then 100
            when ((av.estimated_retail_value
                   - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                   - coalesce(av.estimated_recon_cost, 1500)
                   - coalesce(av.estimated_transport_cost, 350)
                   - coalesce(av.estimated_auction_fee, 500))::numeric
                  / nullif(av.estimated_retail_value, 0)) >= 0.15 then 85
            when ((av.estimated_retail_value
                   - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                   - coalesce(av.estimated_recon_cost, 1500)
                   - coalesce(av.estimated_transport_cost, 350)
                   - coalesce(av.estimated_auction_fee, 500))::numeric
                  / nullif(av.estimated_retail_value, 0)) >= 0.10 then 70
            when ((av.estimated_retail_value
                   - coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
                   - coalesce(av.estimated_recon_cost, 1500)
                   - coalesce(av.estimated_transport_cost, 350)
                   - coalesce(av.estimated_auction_fee, 500))::numeric
                  / nullif(av.estimated_retail_value, 0)) >= 0.0 then 50
            else 25
          end
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;
