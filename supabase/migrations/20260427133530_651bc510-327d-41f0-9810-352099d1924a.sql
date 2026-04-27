
CREATE POLICY "Marketing can view all recordings"
ON public.meeting_recordings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'marketing'::app_role));

CREATE POLICY "Marketing and dev can view all recording files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meeting-recordings' 
  AND (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role))
);

CREATE POLICY "Dev can delete recording files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meeting-recordings' 
  AND has_role(auth.uid(), 'dev'::app_role)
);

CREATE POLICY "Dev can delete recordings"
ON public.meeting_recordings FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'dev'::app_role));
