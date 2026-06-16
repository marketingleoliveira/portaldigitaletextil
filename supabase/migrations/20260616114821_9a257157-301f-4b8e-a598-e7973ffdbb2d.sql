
CREATE POLICY "Reembolsos: users view own files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'reembolsos'
    AND ((auth.uid()::text = (storage.foldername(name))[1]) OR public.has_full_access(auth.uid()))
  );

CREATE POLICY "Reembolsos: users upload own files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reembolsos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Reembolsos: users update own files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'reembolsos'
    AND ((auth.uid()::text = (storage.foldername(name))[1]) OR public.has_full_access(auth.uid()))
  );

CREATE POLICY "Reembolsos: users delete own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reembolsos'
    AND ((auth.uid()::text = (storage.foldername(name))[1]) OR public.has_full_access(auth.uid()))
  );
