-- Update recon formula (LogicLot Optimized for Real Buys)
-- Formula: Recon = CR + Mileage + Age + Brand + Vehicle Type + $400 (risk buffer)
-- No multiplier. Keeps existing risk_adj for extreme flags (salvage/flood/frame).

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

  -- ── Recon components (updated formula) ────────────────────────────────────
  update public.auction_vehicles av
  set
    -- Fixed $400 risk buffer (replaces variable base)
    recon_base = 400,

    -- CR adjustment
    recon_cr_adj = (case
      when av.cr_score is null            then 350
      when av.cr_score >= 4.5             then 100
      when av.cr_score >= 4.0             then 250
      when av.cr_score >= 3.5             then 600
      when av.cr_score >= 3.0             then 1000
      else                                     1500
    end),

    -- Mileage adjustment (less aggressive)
    recon_mileage_adj = (case
      when 'TMU' = ANY(coalesce(av.risk_flags, '{}'::text[]))
        or coalesce(av.title_status,'') ilike '%tmu%' then 1200
      when coalesce(av.mileage, 0) <  40000            then 100
      when coalesce(av.mileage, 0) <  60000            then 250
      when coalesce(av.mileage, 0) <  80000            then 400
      when coalesce(av.mileage, 0) < 100000            then 600
      when coalesce(av.mileage, 0) < 200000            then 1000
      else                                                  1500
    end),

    -- Age adjustment (reduced ~60% — does not overpower mileage or CR)
    recon_age_adj = (case
      when (v_current_year - coalesce(av.year, v_current_year)) <=  3 then  50
      when (v_current_year - coalesce(av.year, v_current_year)) <=  6 then 150
      when (v_current_year - coalesce(av.year, v_current_year)) <= 10 then 300
      else                                                                   500
    end),

    -- Brand reliability (controlled — not deal-blocking)
    recon_brand_adj = (case
      when upper(coalesce(av.make,'')) in ('TOYOTA','HONDA','MAZDA')
        then 0
      when upper(coalesce(av.make,'')) in ('FORD','CHEVROLET','CHEVY','NISSAN','DODGE','HYUNDAI','KIA','SUBARU')
        then 300
      when upper(coalesce(av.make,'')) in ('JEEP','CHRYSLER','VOLKSWAGEN','VW','RAM','MITSUBISHI','BUICK','GMC','LINCOLN','CADILLAC','VOLVO','GENESIS','INFINITI','ACURA')
        then 400
      when upper(coalesce(av.make,'')) in ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO')
        then 1000
      else 200
    end),

    -- Vehicle type adjustment
    -- Performance / luxury sports models get $300 regardless of body type
    recon_type_adj = (case
      when upper(coalesce(av.model,'')) in (
        'MUSTANG','CAMARO','CORVETTE','CHALLENGER','CHARGER','911','718',
        'GR86','BRZ','SUPRA','MX-5','MIATA','Z','370Z','350Z','TT',
        'F-TYPE','CAYMAN','BOXSTER'
      ) then 300
      when upper(coalesce(av.make,'')) in (
        'BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE',
        'JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO'
      ) then 300
      when coalesce(av.vehicle_type,'Other') = 'Truck' then 300
      when coalesce(av.vehicle_type,'Other') = 'SUV'   then 200
      when coalesce(av.vehicle_type,'Other') = 'Van'   then 200
      when coalesce(av.vehicle_type,'Other') = 'Sedan' then   0
      else 100
    end),

    -- Risk flags for extreme/title situations (kept to protect against bad buys)
    recon_risk_adj = (
      (case when coalesce(av.title_status,'') ilike '%salvage%'
              or 'Salvage' = ANY(coalesce(av.risk_flags,'{}'::text[]))
              or 'Rebuilt' = ANY(coalesce(av.risk_flags,'{}'::text[]))
            then 4000 else 0 end)
      + (case when 'Frame damage'    = ANY(coalesce(av.risk_flags,'{}'::text[])) then 3500 else 0 end)
      + (case when 'Flood'           = ANY(coalesce(av.risk_flags,'{}'::text[]))
              or 'Bio'               = ANY(coalesce(av.risk_flags,'{}'::text[]))
              or 'Structural'        = ANY(coalesce(av.risk_flags,'{}'::text[]))
            then 5000 else 0 end)
      + (case when 'Engine issue'       = ANY(coalesce(av.risk_flags,'{}'::text[]))
              or 'Transmission issue'   = ANY(coalesce(av.risk_flags,'{}'::text[]))
            then 3000 else 0 end)
      + (case when 'Airbag issue'            = ANY(coalesce(av.risk_flags,'{}'::text[])) then 2000 else 0 end)
      + (case when 'Mechanical announcement' = ANY(coalesce(av.risk_flags,'{}'::text[])) then 1500 else 0 end)
      + (case when 'Accident history'        = ANY(coalesce(av.risk_flags,'{}'::text[])) then  800 else 0 end)
    )
  where av.run_list_id = p_run_list_id;

  -- Apply recon — no multiplier, no aggressive clamping
  -- Formula: CR + Mileage + Age + Brand + Vehicle Type + $400
  update public.auction_vehicles av
  set estimated_recon_cost =
    case when av.recon_override is not null then av.recon_override
    else round(
      coalesce(av.recon_base,        400)
      + coalesce(av.recon_cr_adj,    350)
      + coalesce(av.recon_mileage_adj, 250)
      + coalesce(av.recon_age_adj,   150)
      + coalesce(av.recon_brand_adj, 200)
      + coalesce(av.recon_type_adj,    0)
      + coalesce(av.recon_risk_adj,    0)
    )
    end
  where av.run_list_id = p_run_list_id;

  -- ── Tiered auction fee ─────────────────────────────────────────────────────
  update public.auction_vehicles av
  set
    estimated_transport_cost = 0,
    estimated_auction_fee = (case
      when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) >= 50000 then 900
      when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) >= 20000 then 600
      when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) >= 3000  then 500
      when coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) >= 1000  then 300
      else 100
    end)
  where av.run_list_id = p_run_list_id;

  -- ── Retail Value Formula ───────────────────────────────────────────────────
  update public.auction_vehicles av
  set retail_base_market_value = coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0)
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set retail_cr_adjustment = (case
    when av.cr_score is null     then -round(coalesce(av.retail_base_market_value, 0) * 0.02)
    when av.cr_score >= 4.5      then  round(coalesce(av.retail_base_market_value, 0) * 0.06)
    when av.cr_score >= 4.0      then  round(coalesce(av.retail_base_market_value, 0) * 0.03)
    when av.cr_score >= 3.5      then  0
    when av.cr_score >= 3.0      then -round(coalesce(av.retail_base_market_value, 0) * 0.03)
    else                              -round(coalesce(av.retail_base_market_value, 0) * 0.06)
  end)
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set retail_mileage_adjustment = (case
    when coalesce(av.mileage, 60000) <  30000 then  round(coalesce(av.retail_base_market_value, 0) * 0.08)
    when coalesce(av.mileage, 60000) <  60000 then  round(coalesce(av.retail_base_market_value, 0) * 0.03)
    when coalesce(av.mileage, 60000) <  90000 then  0
    when coalesce(av.mileage, 60000) < 120000 then -round(coalesce(av.retail_base_market_value, 0) * 0.04)
    else                                           -round(coalesce(av.retail_base_market_value, 0) * 0.08)
  end)
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set retail_dealer_margin = round(coalesce(av.retail_base_market_value, 0) * 0.14)
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set estimated_retail_value = greatest(
    round(coalesce(av.retail_base_market_value, 0) * 0.65),
    least(
      round(coalesce(av.retail_base_market_value, 0) * 1.35),
      coalesce(av.retail_base_market_value, 0)
        + coalesce(av.retail_cr_adjustment, 0)
        + coalesce(av.retail_mileage_adjustment, 0)
        + coalesce(av.retail_dealer_margin, 0)
    )
  )
  where av.run_list_id = p_run_list_id;

  update public.auction_vehicles av
  set retail_market_position = (case
    when coalesce(av.retail_base_market_value, 0) = 0 then 'At Market'
    when av.estimated_retail_value::numeric / av.retail_base_market_value > 1.15 then 'Above Market'
    when av.estimated_retail_value::numeric / av.retail_base_market_value < 0.90 then 'Below Market'
    else 'At Market'
  end)
  where av.run_list_id = p_run_list_id;

  -- ── Max Bid, Profit, Score ─────────────────────────────────────────────────
  -- Max Bid = Retail − Target Profit − Recon − Auction Fees
  -- Estimated Profit = Retail − Wholesale − Recon − Auction Fees
  update public.auction_vehicles av
  set
    recommended_max_bid =
      round(
        av.estimated_retail_value
        - (case when v_has_target then v_target_profit else av.estimated_retail_value * 0.15 end)
        - coalesce(av.estimated_recon_cost, 1350)
        - coalesce(av.estimated_auction_fee, 500)
      ),
    total_estimated_cost =
      coalesce(av.retail_base_market_value, 0)
      + coalesce(av.estimated_recon_cost, 1350)
      + coalesce(av.estimated_auction_fee, 500),
    estimated_profit =
      round(
        av.estimated_retail_value
        - coalesce(av.retail_base_market_value, 0)
        - coalesce(av.estimated_recon_cost, 1350)
        - coalesce(av.estimated_auction_fee, 500)
      ),
    profit_score =
      case
        when av.estimated_retail_value <= 0 then 0
        when v_has_target then
          case
            when (av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500)) >= v_target_profit         then 100
            when (av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500)) >= v_target_profit * 0.80 then  85
            when (av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500)) >= v_target_profit * 0.60 then  70
            when (av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500)) >= 0                      then  50
            else 25
          end
        else
          case
            when ((av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.20 then 100
            when ((av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.15 then  85
            when ((av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.10 then  70
            when ((av.estimated_retail_value - coalesce(av.retail_base_market_value,0) - coalesce(av.estimated_recon_cost,1350) - coalesce(av.estimated_auction_fee,500))::numeric / nullif(av.estimated_retail_value,0)) >= 0.0  then  50
            else 25
          end
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;
