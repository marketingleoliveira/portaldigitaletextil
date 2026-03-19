CREATE POLICY "CRM users can insert user notifications for lead assignment"
ON public.user_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'dev'::app_role) OR has_role(auth.uid(), 'sdr'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role))
  AND auth.uid() = created_by
);