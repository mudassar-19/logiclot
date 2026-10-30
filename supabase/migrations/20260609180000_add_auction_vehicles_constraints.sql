-- Add unique constraint for run_list_id and vin
ALTER TABLE public.auction_vehicles
  ADD CONSTRAINT unique_run_list_vin UNIQUE (run_list_id, vin);

-- Add unique index for run_list_id and lot_number where vin is null
CREATE UNIQUE INDEX IF NOT EXISTS unique_run_list_lot_number
  ON public.auction_vehicles (run_list_id, lot_number)
  WHERE vin IS NULL;
