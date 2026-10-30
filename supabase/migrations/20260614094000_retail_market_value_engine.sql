-- Create vehicle_retail_values table for caching MarketCheck Price API results
CREATE TABLE IF NOT EXISTS public.vehicle_retail_values (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin               VARCHAR(50)   NOT NULL,
  miles             INTEGER       NOT NULL,
  marketcheck_price INTEGER,           -- retail value in whole dollars
  price_mean        INTEGER,           -- from comparables.stats.price.mean
  price_median      INTEGER,           -- from comparables.stats.price.median
  price_std_dev     NUMERIC(10,2),
  comparables_count INTEGER,           -- num_found
  fetched_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  dealer_zip        VARCHAR(10),
  api_status        VARCHAR(20)   DEFAULT 'success',  -- 'success','no_data','error'
  UNIQUE (vin, miles)
);

-- Enable RLS
ALTER TABLE public.vehicle_retail_values ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to read retail cache" ON public.vehicle_retail_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert retail cache" ON public.vehicle_retail_values
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update retail cache" ON public.vehicle_retail_values
  FOR UPDATE TO authenticated USING (true);


-- Create vehicle_announcements table for storing detected and confirmed flags
CREATE TABLE IF NOT EXISTS public.vehicle_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_list_id     UUID NOT NULL REFERENCES public.auction_run_lists(id) ON DELETE CASCADE,
  vin             VARCHAR(50) NOT NULL,
  source          VARCHAR(20) NOT NULL,  -- 'carmax', 'iaai', 'adesa', 'manheim'
  raw_text        TEXT,                  -- original text from the announcement field
  detected_flags  TEXT[] DEFAULT '{}',   -- array: ['salvage','tmu'] etc
  confirmed_flags TEXT[] DEFAULT '{}',   -- flags the buyer has explicitly confirmed
  dismissed_flags TEXT[] DEFAULT '{}',   -- flags the buyer dismissed
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (run_list_id, vin)
);

-- Enable RLS
ALTER TABLE public.vehicle_announcements ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to read announcements" ON public.vehicle_announcements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert announcements" ON public.vehicle_announcements
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update announcements" ON public.vehicle_announcements
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete announcements" ON public.vehicle_announcements
  FOR DELETE TO authenticated USING (true);


-- Add is_bank_lendable column to auction_vehicles table
ALTER TABLE public.auction_vehicles ADD COLUMN IF NOT EXISTS is_bank_lendable BOOLEAN DEFAULT FALSE;
