
-- Drop existing restrictive policies for lead_activities
DROP POLICY IF EXISTS "Devs can insert lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Devs can manage all lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Vendedores can insert activities on assigned leads" ON public.lead_activities;
DROP POLICY IF EXISTS "Vendedores can view activities of assigned leads" ON public.lead_activities;

-- Devs full access
CREATE POLICY "Devs full access to lead activities"
ON public.lead_activities FOR ALL
USING (has_role(auth.uid(), 'dev'::app_role));

-- All vendedores can view all lead activities
CREATE POLICY "Vendedores can view all lead activities"
ON public.lead_activities FOR SELECT
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- Vendedores can insert activities on assigned leads
CREATE POLICY "Vendedores can insert activities on assigned leads"
ON public.lead_activities FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND has_role(auth.uid(), 'vendedor'::app_role)
  AND EXISTS (
    SELECT 1 FROM leads WHERE leads.id = lead_activities.lead_id AND leads.assigned_to = auth.uid()
  )
);
