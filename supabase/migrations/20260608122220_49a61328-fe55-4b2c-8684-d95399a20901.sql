
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'atendimento',
  ADD COLUMN IF NOT EXISTS source_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_scope_idx ON public.leads(scope);
CREATE INDEX IF NOT EXISTS leads_source_lead_id_idx ON public.leads(source_lead_id);
