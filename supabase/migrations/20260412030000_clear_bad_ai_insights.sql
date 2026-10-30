-- Clear any truncated/bad ai_insight values (shorter than 100 chars)
UPDATE public.auction_vehicles
SET ai_insight = NULL
WHERE ai_insight IS NOT NULL AND length(ai_insight) < 100;
