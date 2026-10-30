ALTER TABLE public.dealer_preferences
  ADD COLUMN IF NOT EXISTS allow_tmu boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_models text[] DEFAULT '{}'::text[];