
-- Add file_path column to auction_run_lists
ALTER TABLE public.auction_run_lists ADD COLUMN IF NOT EXISTS file_path text;

-- Create storage bucket for run list files
INSERT INTO storage.buckets (id, name, public)
VALUES ('run-lists', 'run-lists', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their org folder
CREATE POLICY "Users can upload run list files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'run-lists');

-- RLS: authenticated users can read their org files
CREATE POLICY "Users can read run list files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'run-lists');

-- RLS: authenticated users can delete their org files
CREATE POLICY "Users can delete run list files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'run-lists');
