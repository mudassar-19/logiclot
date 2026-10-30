CREATE OR REPLACE FUNCTION public.apply_recommendation_from_score(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  UPDATE public.auction_vehicles av
  SET ai_recommendation = CASE

    -- ADESA / no-price rows: profit based on segment estimates.
    -- Thresholds are higher than real-data rows to reflect estimation uncertainty.
    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
     AND coalesce(av.profit_score, 0)     >= 85
     AND coalesce(av.estimated_profit, 0) >= 5000
    THEN 'Strong Buy'

    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
     AND coalesce(av.profit_score, 0)     >= 70
     AND coalesce(av.estimated_profit, 0) >= 2500
    THEN 'Buy'

    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
     AND coalesce(av.estimated_profit, 0) > 0
     AND coalesce(av.profit_score, 0)     >= 50
    THEN 'Possible Buy'

    WHEN av.buy_now IS NULL
     AND av.current_bid IS NULL
     AND av.price_estimate IS NULL
     AND av.mmr_value IS NULL
     AND av.lot_number IS NULL
    THEN 'Review'

    WHEN (extract(year from current_date)::int - COALESCE(av.year, extract(year from current_date)::int)) >= 15
     AND COALESCE(av.mileage, 0)            >= 150000
     AND COALESCE(av.title_status, '')      ILIKE '%salvage%'
    THEN 'Pass'

    WHEN coalesce(av.estimated_profit, 0) < 0 THEN 'Pass'

    WHEN coalesce(av.mileage, 0)             >= 200000
     AND coalesce(av.estimated_profit, 0)    >= 3000
     AND coalesce(av.recommended_max_bid, 0) >= 1000
    THEN 'Possible Buy'

    WHEN coalesce(av.mileage, 0) >= 200000
    THEN 'Pass'

    WHEN coalesce(av.title_status, '') ILIKE '%non-repairable%'
      OR coalesce(av.title_status, '') ILIKE '%total%'
    THEN 'Pass'

    WHEN coalesce(av.title_status, '') NOT ILIKE '%salvage%'
     AND coalesce(av.title_status, '') NOT ILIKE '%rebuilt%'
     AND coalesce(av.title_status, '') NOT ILIKE '%non-repairable%'
    THEN CASE
      WHEN (lower(coalesce(av.damage_type,     '')) LIKE '%airbag%'
         OR lower(coalesce(av.damage_location, '')) LIKE '%airbag%'
         OR lower(coalesce(av.body_condition,  '')) LIKE '%deployed%'
         OR 'Airbags Deployed' = ANY(coalesce(av.risk_flags, '{}'::text[])))
      THEN CASE
        WHEN coalesce(av.profit_score, 0)        >= 50
         AND coalesce(av.estimated_profit, 0)    >= 1000
         AND coalesce(av.recommended_max_bid, 0) >= 1000
        THEN 'Possible Buy' ELSE 'Pass'
      END

      WHEN coalesce(av.profit_score, 0)        >= 85
       AND coalesce(av.estimated_profit, 0)    >= 4000
       AND coalesce(av.recommended_max_bid, 0) >= 1000
       AND NOT ('Exceeds recon tolerance' = ANY(coalesce(av.risk_flags, '{}'::text[])))
      THEN 'Strong Buy'

      WHEN coalesce(av.profit_score, 0)        >= 70
       AND coalesce(av.estimated_profit, 0)    >= 1500
       AND coalesce(av.recommended_max_bid, 0) >= 1500
      THEN 'Buy'

      WHEN coalesce(av.profit_score, 0)        >= 50
       AND coalesce(av.estimated_profit, 0)    >= 1000
       AND coalesce(av.recommended_max_bid, 0) >= 1000
       AND coalesce(av.mileage, 0)             <  200000
      THEN 'Possible Buy'

      ELSE 'Pass'
    END

    ELSE CASE
      WHEN coalesce(av.profit_score, 0) >= 80
       AND coalesce(av.estimated_profit, 0) > 15000 THEN 'Strong Buy'
      WHEN coalesce(av.profit_score, 0) >= 65
       AND coalesce(av.estimated_profit, 0) >  7000 THEN 'Buy'
      WHEN coalesce(av.profit_score, 0)        >= 50
       AND coalesce(av.estimated_profit, 0)    >  3000
       AND coalesce(av.recommended_max_bid, 0) >= 1000 THEN 'Possible Buy'
      ELSE 'Pass'
    END

  END
  WHERE av.run_list_id = p_run_list_id
    AND (av.ai_summary IS NULL OR av.ai_summary != 'Excluded: does not match your saved buying preferences.');

end;
$function$;

ALTER FUNCTION public.apply_recommendation_from_score(uuid) SET statement_timeout = '120s';
