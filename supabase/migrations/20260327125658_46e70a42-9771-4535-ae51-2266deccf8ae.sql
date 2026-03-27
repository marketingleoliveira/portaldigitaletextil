CREATE POLICY "Gerentes can insert notifications"
ON public.notifications
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) AND (auth.uid() = created_by));