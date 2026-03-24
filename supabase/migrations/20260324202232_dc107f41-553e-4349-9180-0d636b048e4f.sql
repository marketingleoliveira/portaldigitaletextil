
CREATE TABLE public.lead_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  reminder_date timestamp with time zone NOT NULL,
  description text NOT NULL,
  completed_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs full access to lead_reminders" ON public.lead_reminders FOR ALL TO public USING (has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "SDR can manage own reminders" ON public.lead_reminders FOR ALL TO authenticated USING (has_role(auth.uid(), 'sdr'::app_role) AND created_by = auth.uid()) WITH CHECK (has_role(auth.uid(), 'sdr'::app_role) AND created_by = auth.uid());

CREATE POLICY "Vendedores can manage own reminders" ON public.lead_reminders FOR ALL TO authenticated USING (has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid()) WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid());

CREATE POLICY "CRM users can view reminders for their leads" ON public.lead_reminders FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'sdr'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role)
);
