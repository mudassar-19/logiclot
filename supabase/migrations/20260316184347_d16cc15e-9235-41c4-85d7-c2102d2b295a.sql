
INSERT INTO storage.buckets (id, name, public) VALUES ('sales-history', 'sales-history', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload sales history" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sales-history');

CREATE POLICY "Users can view sales history" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'sales-history');

CREATE POLICY "Users can delete sales history" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'sales-history');
