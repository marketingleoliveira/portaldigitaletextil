
-- Table to link lead schedules to meetings
CREATE TABLE public.lead_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  scheduled_date timestamp with time zone NOT NULL,
  title text NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_schedules ENABLE ROW LEVEL SECURITY;

-- Devs full access
CREATE POLICY "Devs full access to lead_schedules"
ON public.lead_schedules FOR ALL
USING (has_role(auth.uid(), 'dev'::app_role));

-- Vendedores can view schedules for their assigned leads
CREATE POLICY "Vendedores can view lead_schedules"
ON public.lead_schedules FOR SELECT
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- Vendedores can insert schedules for their assigned leads
CREATE POLICY "Vendedores can insert lead_schedules"
ON public.lead_schedules FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND has_role(auth.uid(), 'vendedor'::app_role)
  AND EXISTS (
    SELECT 1 FROM leads WHERE leads.id = lead_schedules.lead_id AND leads.assigned_to = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_lead_schedules_updated_at
BEFORE UPDATE ON public.lead_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
