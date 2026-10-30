-- Factor structured damage/condition fields into the recon estimate.
-- Adds recon_damage_adj column (already created by 20260605000000) and rewrites
-- calculate_run_list_profit_engine to include it in the single-pass CTE.

CREATE OR REPLACE FUNCTION public.calculate_run_list_profit_engine(p_run_list_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET statement_timeout = '300s'
AS $function$
DECLARE
  v_target_profit numeric;
  v_has_target    boolean;
  v_current_year  int := extract(year from current_date)::int;
BEGIN
  SELECT dp.target_profit
  INTO   v_target_profit
  FROM   public.dealer_preferences dp
  JOIN   public.auction_run_lists  rl ON rl.organization_id = dp.organization_id
  WHERE  rl.id = p_run_list_id
  LIMIT  1;

  v_has_target := coalesce(v_target_profit, 0) > 0;
  IF NOT v_has_target THEN v_target_profit := 0; END IF;

  WITH
  raw AS (
    SELECT
      av.id,
      av.recon_override,
      av.cr_score,
      av.mileage,
      av.year,
      av.make,
      av.model,
      av.vehicle_type,
      av.title_status,
      av.risk_flags,
      av.damage_location,
      av.damage_type,
      av.drive_condition,
      av.body_condition,
      coalesce(av.mmr_value, av.buy_now, av.price_estimate, av.current_bid, 0) AS rbmv
    FROM public.auction_vehicles av
    WHERE av.run_list_id = p_run_list_id
  ),

  computed AS (
    SELECT
      r.id,
      r.recon_override,
      r.rbmv,
      r.cr_score,
      r.mileage,

      400 AS r_base,

      -- CR adjustment
      (CASE
        WHEN r.cr_score IS NULL    THEN 350
        WHEN r.cr_score >= 4.5     THEN 100
        WHEN r.cr_score >= 4.0     THEN 250
        WHEN r.cr_score >= 3.5     THEN 600
        WHEN r.cr_score >= 3.0     THEN 1000
        ELSE                            1500
       END) AS r_cr,

      -- Mileage adjustment
      (CASE
        WHEN 'TMU' = ANY(coalesce(r.risk_flags, '{}'::text[]))
          OR coalesce(r.title_status,'') ILIKE '%tmu%'   THEN 1200
        WHEN coalesce(r.mileage,0) <  40000              THEN  100
        WHEN coalesce(r.mileage,0) <  60000              THEN  250
        WHEN coalesce(r.mileage,0) <  80000              THEN  400
        WHEN coalesce(r.mileage,0) < 100000              THEN  600
        WHEN coalesce(r.mileage,0) < 200000              THEN 1000
        ELSE                                                   1500
       END) AS r_mil,

      -- Age adjustment
      (CASE
        WHEN (v_current_year - coalesce(r.year, v_current_year)) <=  3 THEN   50
        WHEN (v_current_year - coalesce(r.year, v_current_year)) <=  6 THEN  150
        WHEN (v_current_year - coalesce(r.year, v_current_year)) <= 10 THEN  300
        ELSE                                                                   500
       END) AS r_age,

      -- Brand reliability adjustment
      (CASE
        WHEN upper(coalesce(r.make,'')) IN ('TOYOTA','HONDA','MAZDA')
          THEN 0
        WHEN upper(coalesce(r.make,'')) IN ('FORD','CHEVROLET','CHEVY','NISSAN','DODGE','HYUNDAI','KIA','SUBARU')
          THEN 300
        WHEN upper(coalesce(r.make,'')) IN ('JEEP','CHRYSLER','VOLKSWAGEN','VW','RAM','MITSUBISHI','BUICK','GMC','LINCOLN','CADILLAC','VOLVO','GENESIS','INFINITI','ACURA')
          THEN 400
        WHEN upper(coalesce(r.make,'')) IN ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO')
          THEN 1000
        ELSE 200
       END) AS r_brand,

      -- Vehicle type adjustment
      (CASE
        WHEN upper(coalesce(r.model,'')) IN (
          'MUSTANG','CAMARO','CORVETTE','CHALLENGER','CHARGER','911','718',
          'GR86','BRZ','SUPRA','MX-5','MIATA','Z','370Z','350Z','TT',
          'F-TYPE','CAYMAN','BOXSTER') THEN 300
        WHEN upper(coalesce(r.make,'')) IN (
          'BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE',
          'JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO') THEN 300
        WHEN coalesce(r.vehicle_type,'Other') = 'Truck'  THEN 300
        WHEN coalesce(r.vehicle_type,'Other') IN ('SUV','Van') THEN 200
        WHEN coalesce(r.vehicle_type,'Other') = 'Sedan'  THEN 0
        ELSE 100
       END) AS r_type,

      -- Damage location/type adjustment (from structured IAA fields)
      -- Deployed airbags always carry the largest cost regardless of location.
      (CASE
        WHEN coalesce(r.body_condition,'') ILIKE '%deployed%'        THEN 2500
        ELSE 0
       END
       +
       CASE
        WHEN coalesce(r.damage_location,'') ILIKE '%front & rear%'
          OR coalesce(r.damage_location,'') ILIKE '%all over%'       THEN 2500
        WHEN coalesce(r.damage_location,'') ILIKE '%front end%'      THEN 1800
        WHEN coalesce(r.damage_location,'') ILIKE '%side%'           THEN 1200
        WHEN coalesce(r.damage_location,'') ILIKE '%rear%'           THEN  800
        WHEN coalesce(r.damage_location,'') ILIKE '%normal wear%'
          OR coalesce(r.damage_type,'')     ILIKE '%normal wear%'    THEN    0
        WHEN r.damage_location IS NOT NULL                            THEN 1000
        ELSE 0
       END
       +
       -- No-start vehicles have unknown mechanical issues
       CASE
        WHEN coalesce(r.drive_condition,'') ILIKE '%no start%'       THEN 1500
        WHEN coalesce(r.drive_condition,'') ILIKE '%run%drive%'      THEN  -200
        ELSE 0
       END) AS r_damage,

      -- Risk flag adjustment (title/structural — unchanged)
      (
        (CASE WHEN coalesce(r.title_status,'') ILIKE '%salvage%'
                OR 'Salvage' = ANY(coalesce(r.risk_flags,'{}'::text[]))
                OR 'Rebuilt' = ANY(coalesce(r.risk_flags,'{}'::text[]))
              THEN 4000 ELSE 0 END)
        + (CASE WHEN 'Frame damage'        = ANY(coalesce(r.risk_flags,'{}'::text[])) THEN 3500 ELSE 0 END)
        + (CASE WHEN 'Flood'               = ANY(coalesce(r.risk_flags,'{}'::text[]))
                OR 'Bio'                   = ANY(coalesce(r.risk_flags,'{}'::text[]))
                OR 'Structural'            = ANY(coalesce(r.risk_flags,'{}'::text[]))
              THEN 5000 ELSE 0 END)
        + (CASE WHEN 'Engine issue'        = ANY(coalesce(r.risk_flags,'{}'::text[]))
                OR 'Transmission issue'    = ANY(coalesce(r.risk_flags,'{}'::text[]))
              THEN 3000 ELSE 0 END)
        + (CASE WHEN 'Airbag issue'             = ANY(coalesce(r.risk_flags,'{}'::text[])) THEN 2000 ELSE 0 END)
        + (CASE WHEN 'Mechanical announcement'  = ANY(coalesce(r.risk_flags,'{}'::text[])) THEN 1500 ELSE 0 END)
        + (CASE WHEN 'Accident history'         = ANY(coalesce(r.risk_flags,'{}'::text[])) THEN  800 ELSE 0 END)
      ) AS r_risk,

      -- Tiered auction fee
      (CASE
        WHEN coalesce(r.rbmv,0) >= 50000 THEN 900
        WHEN coalesce(r.rbmv,0) >= 20000 THEN 600
        WHEN coalesce(r.rbmv,0) >= 3000  THEN 500
        WHEN coalesce(r.rbmv,0) >= 1000  THEN 300
        ELSE 100
       END) AS afee,

      -- Retail CR adjustment
      (CASE
        WHEN r.cr_score IS NULL    THEN -round(r.rbmv * 0.02)
        WHEN r.cr_score >= 4.5     THEN  round(r.rbmv * 0.06)
        WHEN r.cr_score >= 4.0     THEN  round(r.rbmv * 0.03)
        WHEN r.cr_score >= 3.5     THEN  0
        WHEN r.cr_score >= 3.0     THEN -round(r.rbmv * 0.03)
        ELSE                           -round(r.rbmv * 0.06)
       END) AS rcr_adj,

      -- Retail mileage adjustment
      (CASE
        WHEN coalesce(r.mileage, 60000) <  30000 THEN  round(r.rbmv * 0.08)
        WHEN coalesce(r.mileage, 60000) <  60000 THEN  round(r.rbmv * 0.03)
        WHEN coalesce(r.mileage, 60000) <  90000 THEN  0
        WHEN coalesce(r.mileage, 60000) < 120000 THEN -round(r.rbmv * 0.04)
        ELSE                                          -round(r.rbmv * 0.08)
       END) AS rmil_adj,

      -- Dealer margin
      round(r.rbmv * 0.14) AS rdm

    FROM raw r
  ),

  final_v AS (
    SELECT
      c.*,
      CASE WHEN c.recon_override IS NOT NULL THEN c.recon_override
           ELSE round(c.r_base + c.r_cr + c.r_mil + c.r_age + c.r_brand + c.r_type + c.r_damage + c.r_risk)
       END AS est_recon,
      greatest(
        round(c.rbmv * 0.65),
        least(round(c.rbmv * 1.35),
              c.rbmv + c.rcr_adj + c.rmil_adj + c.rdm)
      ) AS erv
    FROM computed c
  )

  UPDATE public.auction_vehicles av
  SET
    recon_base                = f.r_base,
    recon_cr_adj              = f.r_cr,
    recon_mileage_adj         = f.r_mil,
    recon_age_adj             = f.r_age,
    recon_brand_adj           = f.r_brand,
    recon_type_adj            = f.r_type,
    recon_damage_adj          = f.r_damage,
    recon_risk_adj            = f.r_risk,
    estimated_recon_cost      = f.est_recon,
    estimated_transport_cost  = 0,
    estimated_auction_fee     = f.afee,
    retail_base_market_value  = f.rbmv,
    retail_cr_adjustment      = f.rcr_adj,
    retail_mileage_adjustment = f.rmil_adj,
    retail_dealer_margin      = f.rdm,
    estimated_retail_value    = f.erv,
    retail_market_position    = CASE
      WHEN f.rbmv = 0                                                     THEN 'At Market'
      WHEN f.erv::numeric / nullif(f.rbmv, 0) > 1.15                     THEN 'Above Market'
      WHEN f.erv::numeric / nullif(f.rbmv, 0) < 0.90                     THEN 'Below Market'
      ELSE                                                                      'At Market'
     END,
    recommended_max_bid = round(
      f.erv
      - (CASE WHEN v_has_target THEN v_target_profit ELSE f.erv * 0.15 END)
      - coalesce(f.est_recon, 1350)
      - f.afee
    ),
    total_estimated_cost = f.rbmv + coalesce(f.est_recon, 1350) + f.afee,
    estimated_profit = round(
      f.erv
      - f.rbmv
      - coalesce(f.est_recon, 1350)
      - f.afee
    ),
    profit_score = CASE
      WHEN f.erv <= 0 THEN 0
      WHEN v_has_target THEN
        CASE
          WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= v_target_profit        THEN 100
          WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= v_target_profit * 0.80 THEN  85
          WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= v_target_profit * 0.60 THEN  70
          WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= 0                      THEN  50
          ELSE 25
        END
      ELSE
        CASE
          WHEN ((f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee)::numeric / nullif(f.erv,0)) >= 0.20 THEN 100
          WHEN ((f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee)::numeric / nullif(f.erv,0)) >= 0.15 THEN  85
          WHEN ((f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee)::numeric / nullif(f.erv,0)) >= 0.10 THEN  70
          WHEN ((f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee)::numeric / nullif(f.erv,0)) >= 0.0  THEN  50
          ELSE 25
        END
     END
  FROM final_v f
  WHERE av.id = f.id;

END;
$function$;

ALTER FUNCTION public.calculate_run_list_profit_engine(uuid) SET statement_timeout = '300s';
