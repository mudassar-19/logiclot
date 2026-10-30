-- Remove the 'clean' default so vehicles without a known title are NULL, not falsely clean.
-- Salvage vehicles that were silently defaulted to 'clean' will correctly be NULL on new inserts.
ALTER TABLE public.auction_vehicles ALTER COLUMN title_status DROP DEFAULT;
