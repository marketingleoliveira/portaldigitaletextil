DROP POLICY IF EXISTS "Reembolsos: users view own files" ON storage.objects;
CREATE POLICY "Reembolsos: users view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reembolsos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_full_access(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  )
);