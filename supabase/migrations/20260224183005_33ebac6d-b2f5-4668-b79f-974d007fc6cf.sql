-- Allow dev role to delete completed lead_schedules
CREATE POLICY "Devs can delete completed lead_schedules"
ON public.lead_schedules
FOR DELETE
USING (has_role(auth.uid(), 'dev'::app_role) AND completed_at IS NOT NULL);

-- Allow dev role to update lead_schedules (for marking complete)
CREATE POLICY "Vendedores can update own lead_schedules"
ON public.lead_schedules
FOR UPDATE
USING (has_role(auth.uid(), 'vendedor'::app_role) AND (created_by = auth.uid()));

CREATE POLICY "Devs can update lead_schedules"
ON public.lead_schedules
FOR UPDATE
USING (has_role(auth.uid(), 'dev'::app_role));