
-- Create marketing lead status enum
CREATE TYPE public.marketing_lead_status AS ENUM ('lead', 'contato_inicial', 'resposta', 'agendado', 'depoimento_realizado');

-- Create marketing_leads table
CREATE TABLE public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  status marketing_lead_status NOT NULL DEFAULT 'lead',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Marketing and dev can do everything
CREATE POLICY "Marketing full access" ON public.marketing_leads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role))
  WITH CHECK (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role));

-- Dev can delete
CREATE POLICY "Dev can delete marketing leads" ON public.marketing_leads
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'dev'::app_role));
