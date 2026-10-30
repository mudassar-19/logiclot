-- Fix: IAA price_estimate is ACV/Estimated Retail Value, not an acquisition cost.
--
-- Root cause: rbmv coalesce falls through to price_estimate for IAA rows that have
-- no buy_now/current_bid. Since price_estimate ≈ retail, profit = retail − retail − recon − fee
-- ≈ −(recon + fee) for every IAA car, producing the −$569k phantom total.
--
-- Changes:
--   1. Split rbmv into two values: rbmv (acquisition cost) and retail_anchor (ERV base).
--      For non-IAA rows these are identical (wholesale price). For IAA rows, retail_anchor
--      = price_estimate (ACV) while rbmv = buy_now ?? current_bid ?? salvage fraction of ACV.
--   2. Salvage fraction by drive_condition: Run & Drive 40%, Starts 25%, No Start/Stationary 15%, unknown 30%.
--   3. All ERV percentage adjustments (rcr_adj, rmil_adj, rdm) and the ERV clamp now reference
--      retail_anchor, not rbmv — otherwise the 65–135% cap would be anchored to acquisition cost.
--   4. NULL-CR recon penalty ($350) suppressed for IAA rows; IAA never supplies a CR score so the
--      penalty is a structural tax, not a condition signal. r_risk already prices actual damage.

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
      av.drive_condition,
      av.buy_now,
      av.current_bid,
      av.price_estimate,
      av.mmr_value,
      -- IAA detection: lot_number present + at least one structured condition field.
      -- These fields are only populated by the IAA parser / Gemini IAA OCR path.
      (av.lot_number IS NOT NULL AND (
        av.title_status    IS NOT NULL OR
        av.damage_location IS NOT NULL OR
        av.damage_type     IS NOT NULL OR
        av.drive_condition IS NOT NULL
      )) AS is_iaa
    FROM public.auction_vehicles av
    WHERE av.run_list_id = p_run_list_id
  ),

  -- Separate acquisition cost (rbmv) from retail anchor (retail_anchor).
  -- For IAA rows with no bid: estimate salvage hammer price as fraction of ACV.
  sourced AS (
    SELECT
      r.*,
      -- retail_anchor: what this vehicle is worth on the retail market.
      -- IAA price_estimate = ACV published by IAA — correct retail anchor.
      -- Non-IAA: wholesale price already anchors ERV.
      CASE WHEN r.is_iaa
        THEN coalesce(r.price_estimate, r.mmr_value, 0)
        ELSE coalesce(r.buy_now, r.current_bid, r.price_estimate, r.mmr_value, 0)
      END AS retail_anchor,
      -- rbmv: what you actually pay at the auction.
      CASE
        WHEN NOT r.is_iaa
          THEN coalesce(r.buy_now, r.current_bid, r.price_estimate, r.mmr_value, 0)
        ELSE
          coalesce(
            r.buy_now,
            r.current_bid,
            CASE
              WHEN lower(coalesce(r.drive_condition,'')) LIKE '%run%drive%'
                OR  lower(coalesce(r.drive_condition,'')) LIKE '%run and drive%'
                THEN round(coalesce(r.price_estimate, r.mmr_value, 0)::numeric * 0.40)
              WHEN lower(coalesce(r.drive_condition,'')) LIKE '%start%'
               AND lower(coalesce(r.drive_condition,'')) NOT LIKE '%no start%'
                THEN round(coalesce(r.price_estimate, r.mmr_value, 0)::numeric * 0.25)
              WHEN lower(coalesce(r.drive_condition,'')) LIKE '%no start%'
                OR  lower(coalesce(r.drive_condition,'')) LIKE '%stationary%'
                OR  lower(coalesce(r.drive_condition,'')) LIKE '%not run%'
                THEN round(coalesce(r.price_estimate, r.mmr_value, 0)::numeric * 0.15)
              ELSE round(coalesce(r.price_estimate, r.mmr_value, 0)::numeric * 0.30)
            END,
            0
          )
      END AS rbmv
    FROM raw r
  ),

  computed AS (
    SELECT
      s.id,
      s.recon_override,
      s.rbmv,
      s.retail_anchor,
      s.cr_score,
      s.mileage,
      s.is_iaa,

      400 AS r_base,

      -- CR recon: IAA never supplies a CR score — NULL means "not applicable", not "unknown condition".
      -- Suppress the $350 NULL penalty for IAA; r_risk already prices actual damage.
      (CASE
        WHEN s.cr_score IS NULL AND s.is_iaa THEN 0
        WHEN s.cr_score IS NULL              THEN 350
        WHEN s.cr_score >= 4.5               THEN 100
        WHEN s.cr_score >= 4.0               THEN 250
        WHEN s.cr_score >= 3.5               THEN 600
        WHEN s.cr_score >= 3.0               THEN 1000
        ELSE                                      1500
      END) AS r_cr,

      (CASE
        WHEN 'TMU' = ANY(coalesce(s.risk_flags, '{}'::text[]))
          OR coalesce(s.title_status,'') ILIKE '%tmu%' THEN 1200
        WHEN coalesce(s.mileage,0) <  40000 THEN  100
        WHEN coalesce(s.mileage,0) <  60000 THEN  250
        WHEN coalesce(s.mileage,0) <  80000 THEN  400
        WHEN coalesce(s.mileage,0) < 100000 THEN  600
        WHEN coalesce(s.mileage,0) < 200000 THEN 1000
        ELSE                                      1500
      END) AS r_mil,

      (CASE
        WHEN (v_current_year - coalesce(s.year, v_current_year)) <=  3 THEN   50
        WHEN (v_current_year - coalesce(s.year, v_current_year)) <=  6 THEN  150
        WHEN (v_current_year - coalesce(s.year, v_current_year)) <= 10 THEN  300
        ELSE                                                                   500
      END) AS r_age,

      (CASE
        WHEN upper(coalesce(s.make,'')) IN ('TOYOTA','HONDA','MAZDA') THEN 0
        WHEN upper(coalesce(s.make,'')) IN ('FORD','CHEVROLET','CHEVY','NISSAN','DODGE','HYUNDAI','KIA','SUBARU') THEN 300
        WHEN upper(coalesce(s.make,'')) IN ('JEEP','CHRYSLER','VOLKSWAGEN','VW','RAM','MITSUBISHI','BUICK','GMC','LINCOLN','CADILLAC','VOLVO','GENESIS','INFINITI','ACURA') THEN 400
        WHEN upper(coalesce(s.make,'')) IN ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO') THEN 1000
        ELSE 200
      END) AS r_brand,

      (CASE
        WHEN upper(coalesce(s.model,'')) IN ('MUSTANG','CAMARO','CORVETTE','CHALLENGER','CHARGER','911','718','GR86','BRZ','SUPRA','MX-5','MIATA','Z','370Z','350Z','TT','F-TYPE','CAYMAN','BOXSTER') THEN 300
        WHEN upper(coalesce(s.make,''))  IN ('BMW','MERCEDES-BENZ','MERCEDES','AUDI','LAND ROVER','PORSCHE','JAGUAR','MASERATI','BENTLEY','ROLLS-ROYCE','ALFA ROMEO') THEN 300
        WHEN coalesce(s.vehicle_type,'Other') = 'Truck'        THEN 300
        WHEN coalesce(s.vehicle_type,'Other') IN ('SUV','Van') THEN 200
        WHEN coalesce(s.vehicle_type,'Other') = 'Sedan'        THEN 0
        ELSE 100
      END) AS r_type,

      (
        (CASE WHEN coalesce(s.title_status,'') ILIKE '%salvage%'
          OR 'Salvage' = ANY(coalesce(s.risk_flags,'{}'::text[]))
          OR 'Rebuilt' = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN 4000 ELSE 0 END)
        + (CASE WHEN 'Frame damage'       = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN 3500 ELSE 0 END)
        + (CASE WHEN 'Flood'              = ANY(coalesce(s.risk_flags,'{}'::text[]))
          OR 'Bio'                        = ANY(coalesce(s.risk_flags,'{}'::text[]))
          OR 'Structural'                 = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN 5000 ELSE 0 END)
        + (CASE WHEN 'Engine issue'       = ANY(coalesce(s.risk_flags,'{}'::text[]))
          OR 'Transmission issue'         = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN 3000 ELSE 0 END)
        + (CASE WHEN 'Airbag issue'            = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN 2000 ELSE 0 END)
        + (CASE WHEN 'Mechanical announcement' = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN 1500 ELSE 0 END)
        + (CASE WHEN 'Accident history'        = ANY(coalesce(s.risk_flags,'{}'::text[])) THEN  800 ELSE 0 END)
      ) AS r_risk,

      -- Auction fee tiers based on acquisition cost (rbmv), not retail
      (CASE
        WHEN coalesce(s.rbmv,0) >= 50000 THEN 900
        WHEN coalesce(s.rbmv,0) >= 20000 THEN 600
        WHEN coalesce(s.rbmv,0) >= 3000  THEN 500
        WHEN coalesce(s.rbmv,0) >= 1000  THEN 300
        ELSE 100
      END) AS afee,

      -- Retail adjustments — all percentages reference retail_anchor, not rbmv
      (CASE
        WHEN s.cr_score IS NULL    THEN -round(s.retail_anchor * 0.02)
        WHEN s.cr_score >= 4.5     THEN  round(s.retail_anchor * 0.06)
        WHEN s.cr_score >= 4.0     THEN  round(s.retail_anchor * 0.03)
        WHEN s.cr_score >= 3.5     THEN  0
        WHEN s.cr_score >= 3.0     THEN -round(s.retail_anchor * 0.03)
        ELSE                           -round(s.retail_anchor * 0.06)
      END) AS rcr_adj,

      (CASE
        WHEN coalesce(s.mileage, 60000) <  30000 THEN  round(s.retail_anchor * 0.08)
        WHEN coalesce(s.mileage, 60000) <  60000 THEN  round(s.retail_anchor * 0.03)
        WHEN coalesce(s.mileage, 60000) <  90000 THEN  0
        WHEN coalesce(s.mileage, 60000) < 120000 THEN -round(s.retail_anchor * 0.04)
        ELSE                                         -round(s.retail_anchor * 0.08)
      END) AS rmil_adj,

      round(s.retail_anchor * 0.14) AS rdm

    FROM sourced s
  ),

  final_v AS (
    SELECT
      c.*,
      CASE WHEN c.recon_override IS NOT NULL THEN c.recon_override
           ELSE round(c.r_base + c.r_cr + c.r_mil + c.r_age + c.r_brand + c.r_type + c.r_risk)
      END AS est_recon,
      -- ERV clamped around retail_anchor (for IAA: ACV; for others: wholesale price)
      greatest(
        round(c.retail_anchor * 0.65),
        least(
          round(c.retail_anchor * 1.35),
          c.retail_anchor + c.rcr_adj + c.rmil_adj + c.rdm
        )
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
    recon_risk_adj            = f.r_risk,
    estimated_recon_cost      = f.est_recon,
    estimated_transport_cost  = 0,
    estimated_auction_fee     = f.afee,
    retail_base_market_value  = f.retail_anchor,
    retail_cr_adjustment      = f.rcr_adj,
    retail_mileage_adjustment = f.rmil_adj,
    retail_dealer_margin      = f.rdm,
    estimated_retail_value    = f.erv,
    retail_market_position    = CASE
      WHEN f.retail_anchor = 0                                           THEN 'At Market'
      WHEN f.erv::numeric / nullif(f.retail_anchor, 0) > 1.15           THEN 'Above Market'
      WHEN f.erv::numeric / nullif(f.retail_anchor, 0) < 0.90           THEN 'Below Market'
      ELSE                                                                    'At Market'
    END,
    recommended_max_bid = round(
      f.erv
      - (CASE WHEN v_has_target THEN v_target_profit ELSE f.erv * 0.15 END)
      - coalesce(f.est_recon, 1350)
      - f.afee
    ),
    total_estimated_cost = f.rbmv + coalesce(f.est_recon, 1350) + f.afee,
    estimated_profit = round(
      f.erv - f.rbmv - coalesce(f.est_recon, 1350) - f.afee
    ),
    profit_score = CASE
      WHEN f.erv <= 0 THEN 0
      WHEN v_has_target THEN CASE
        WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= v_target_profit        THEN 100
        WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= v_target_profit * 0.80 THEN  85
        WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= v_target_profit * 0.60 THEN  70
        WHEN (f.erv - f.rbmv - coalesce(f.est_recon,1350) - f.afee) >= 0                      THEN  50
        ELSE 25
      END
      ELSE CASE
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
