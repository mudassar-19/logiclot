CREATE OR REPLACE FUNCTION public.calculate_run_list_profit_engine(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_target_profit numeric;
  v_has_target boolean;
  v_current_year int := extract(year from current_date)::int;
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

  update public.auction_vehicles av
  set
    recon_base = (case
      when upper(coalesce(av.make,'')) in ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LEXUS','PORSCHE','LAND ROVER','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','GENESIS','INFINITI','ACURA','VOLVO','ALFA ROMEO','LINCOLN','CADILLAC') then 1300
      when upper(coalesce(av.model,'')) in ('MUSTANG','CAMARO','CORVETTE','CHALLENGER','911','718','GR86','BRZ','SUPRA','MX-5','MIATA','Z','370Z','350Z','TT','F-TYPE') then 1800
      when coalesce(av.vehicle_type,'Other') = 'Truck' then 1000
      when coalesce(av.vehicle_type,'Other') = 'Van' then 1000
      when coalesce(av.vehicle_type,'Other') = 'SUV' then 900
      when coalesce(av.vehicle_type,'Other') = 'Sedan' then 700
      else 900
    end),
    recon_cr_adj = (case
      when av.cr_score is null then 150
      when av.cr_score >= 4.5 then 0
      when av.cr_score >= 4.0 then 250
      when av.cr_score >= 3.5 then 600
      when av.cr_score >= 3.0 then 1000
      when av.cr_score >= 2.5 then 1600
      when av.cr_score >= 2.0 then 2300
      else 3500
    end),
    recon_age_adj = (case
      when (v_current_year - coalesce(av.year, v_current_year)) <= 2 then 0
      when (v_current_year - coalesce(av.year, v_current_year)) <= 5 then 200
      when (v_current_year - coalesce(av.year, v_current_year)) <= 8 then 500
      when (v_current_year - coalesce(av.year, v_current_year)) <= 12 then 900
      else 1400
    end),
    recon_mileage_adj = (case
      when 'TMU' = ANY(coalesce(av.risk_flags, '{}'::text[])) or coalesce(av.title_status,'') ilike '%tmu%' then 1500
      when coalesce(av.mileage,0) <= 30000 then 0
      when coalesce(av.mileage,0) <= 60000 then 150
      when coalesce(av.mileage,0) <= 90000 then 350
      when coalesce(av.mileage,0) <= 120000 then 700
      when coalesce(av.mileage,0) <= 150000 then 1100
      when coalesce(av.mileage,0) <= 200000 then 1700
      else 2500
    end),
    recon_type_adj = (case
      when coalesce(av.vehicle_type,'Other') = 'Sedan' then 0
      when coalesce(av.vehicle_type,'Other') = 'SUV' and upper(coalesce(av.model,'')) in ('CR-V','CRV','RAV4','TUCSON','SPORTAGE','SELTOS','KICKS','TRAX','TRAILBLAZER','VENUE','KONA','HR-V','HRV','CROSSTREK','CX-30','CX30','ECLIPSE CROSS','TAOS') then 150
      when coalesce(av.vehicle_type,'Other') = 'SUV' then 350
      when coalesce(av.vehicle_type,'Other') = 'Truck' then 400
      when coalesce(av.vehicle_type,'Other') = 'Van' then 300
      when coalesce(av.vehicle_type,'Other') = 'Coupe' then 700
      else 0
    end),
    recon_brand_adj = (case
      when upper(coalesce(av.make,'')) in ('TOYOTA','HONDA','MAZDA') then 0
      when upper(coalesce(av.make,'')) in ('NISSAN','HYUNDAI','KIA','CHEVROLET','FORD','SUBARU') then 100
      when upper(coalesce(av.make,'')) in ('JEEP','DODGE','CHRYSLER','VOLKSWAGEN','VW','RAM','MITSUBISHI','BUICK','GMC') then 200
      when upper(coalesce(av.make,'')) in ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO') then 500
      else 100
    end),
    recon_risk_adj = (
      (case when coalesce(av.title_status,'') ilike '%salvage%' or 'Salvage' = ANY(coalesce(av.risk_flags,'{}'::text[])) or 'Rebuilt' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 4000 else 0 end)
      + (case when 'Frame damage' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 3500 else 0 end)
      + (case when 'Flood' = ANY(coalesce(av.risk_flags,'{}'::text[])) or 'Bio' = ANY(coalesce(av.risk_flags,'{}'::text[])) or 'Structural' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 5000 else 0 end)
      + (case when 'Engine issue' = ANY(coalesce(av.risk_flags,'{}'::text[])) or 'Transmission issue' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 3000 else 0 end)
      + (case when 'Airbag issue' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 2000 else 0 end)
      + (case when 'Mechanical announcement' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 1500 else 0 end)
      + (case when 'Accident history' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 800 else 0 end)
    )
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set estimated_recon_cost = 
    case when av.recon_override is not null then av.recon_override
    else greatest(500, least(8000,
      round((coalesce(av.recon_base,900) + coalesce(av.recon_cr_adj,150) + coalesce(av.recon_age_adj,0) + coalesce(av.recon_mileage_adj,0) + coalesce(av.recon_type_adj,0) + coalesce(av.recon_brand_adj,100) + coalesce(av.recon_risk_adj,0)) * 0.80)
    ))
    end
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set
    estimated_transport_cost = coalesce(av.estimated_transport_cost, 350),
    estimated_auction_fee = coalesce(av.estimated_auction_fee, 500)
  where av.run_list_id = p_run_list_id;

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

  update public.auction_vehicles av
  set
    recommended_max_bid =
      round(
        av.estimated_retail_value
        - (case when v_has_target then v_target_profit else av.estimated_retail_value * 0.15 end)
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
            when (av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500)) >= v_target_profit then 100
            when (av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500)) >= v_target_profit * 0.80 then 85
            when (av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500)) >= v_target_profit * 0.60 then 70
            when (av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500)) >= 0 then 50
            else 25
          end
        else
          case
            when ((av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.20 then 100
            when ((av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.15 then 85
            when ((av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.10 then 70
            when ((av.estimated_retail_value - coalesce(av.mmr_value,av.buy_now,av.price_estimate,av.current_bid,0) - coalesce(av.estimated_recon_cost,1500) - coalesce(av.estimated_transport_cost,350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.0 then 50
            else 25
          end
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;