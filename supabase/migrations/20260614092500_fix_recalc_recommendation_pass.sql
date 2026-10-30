-- Fix: Recalculate recommendation for non-excluded vehicles even if they currently have 'Pass' status.
-- This ensures that when a dealer corrects reconditioning costs, the scoring pipeline can restore 'Buy' / 'Strong Buy' status.

CREATE OR REPLACE FUNCTION public.apply_recommendation_from_score(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- Step 1: Update the recommendation based on calibrated thresholds
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

  -- Step 2: Synchronize the ai_summary column based on the updated ai_recommendation value
  UPDATE public.auction_vehicles av
  SET ai_summary = CASE
    WHEN av.ai_recommendation = 'Strong Buy' THEN
      CASE
        WHEN COALESCE(av.title_status, '') ILIKE '%salvage%' OR COALESCE(av.title_status, '') ILIKE '%rebuilt%' THEN
          'Strong margin on salvage title — confirm title transfer process before bidding.'
        ELSE 'Strong margin opportunity matching your dealership preferences.'
      END
    WHEN av.ai_recommendation = 'Buy' THEN
      CASE
        WHEN COALESCE(av.title_status, '') ILIKE '%salvage%' OR COALESCE(av.title_status, '') ILIKE '%rebuilt%' THEN
          'Good margin on salvage title. Factor title conversion cost into your bid.'
        ELSE 'Solid candidate aligned with your buying strategy.'
      END
    WHEN av.ai_recommendation = 'Possible Buy' THEN
      CASE
        WHEN COALESCE(av.title_status, '') ILIKE '%salvage%' OR COALESCE(av.title_status, '') ILIKE '%rebuilt%' THEN
          'Marginal salvage opportunity. Verify title path and confirm margin covers conversion cost.'
        ELSE 'Worth reviewing, but does not fully match your preferred buying criteria.'
      END
    WHEN av.ai_recommendation = 'Pass' THEN
      CASE
        WHEN COALESCE(av.estimated_profit, 0) < 0 THEN
          'Negative estimated profit — this vehicle would lose money at current valuations.'
        WHEN COALESCE(av.mileage, 0) >= 200000 THEN
          'Does not align: Mileage exceeds 200,000 miles limit.'
        WHEN COALESCE(av.title_status, '') ILIKE '%non-repairable%' OR COALESCE(av.title_status, '') ILIKE '%total%' THEN
          'Does not align: Non-repairable or total loss title status.'
        WHEN (lower(COALESCE(av.damage_type,     '')) LIKE '%airbag%'
              OR lower(COALESCE(av.damage_location, '')) LIKE '%airbag%'
              OR 'Airbags Deployed' = ANY(COALESCE(av.risk_flags, '{}'::text[]))) THEN
          'Does not align: Deployed airbags detected.'
        ELSE
          'Does not align with your dealership buying strategy.'
      END
    WHEN av.ai_recommendation = 'Review' THEN
      CASE
        WHEN av.buy_now IS NULL AND av.current_bid IS NULL AND av.price_estimate IS NULL AND av.mmr_value IS NULL AND av.lot_number IS NULL THEN
          'No market or wholesale pricing available. Segment estimates require dealer validation.'
        ELSE 'Requires review.'
      END
    ELSE av.ai_summary
  END
  WHERE av.run_list_id = p_run_list_id
    -- Only update non-excluded vehicles (excluded ones already have their specific summary set by apply_hard_preference_filters)
    AND (av.ai_summary IS NULL OR av.ai_summary != 'Excluded: does not match your saved buying preferences.');

end;
$function$;

ALTER FUNCTION public.apply_recommendation_from_score(uuid) SET statement_timeout = '120s';
