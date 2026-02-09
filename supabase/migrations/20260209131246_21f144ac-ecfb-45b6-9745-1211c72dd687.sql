
-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('novo', 'contatado', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido');

-- Create enum for lead source
CREATE TYPE public.lead_source AS ENUM ('indicacao', 'site', 'telefone', 'email', 'rede_social', 'evento', 'outro');

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  status lead_status NOT NULL DEFAULT 'novo',
  source lead_source NOT NULL DEFAULT 'outro',
  estimated_value NUMERIC DEFAULT 0,
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_contact_at TIMESTAMP WITH TIME ZONE,
  expected_close_date DATE
);

-- Create lead activities table for history tracking
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'note', 'status_change', 'call', 'email', 'meeting'
  description TEXT NOT NULL,
  previous_status lead_status,
  new_status lead_status,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads
-- Devs can do everything
CREATE POLICY "Devs can manage all leads"
  ON public.leads FOR ALL
  USING (has_role(auth.uid(), 'dev'::app_role));

-- Vendedores can view leads assigned to them
CREATE POLICY "Vendedores can view assigned leads"
  ON public.leads FOR SELECT
  USING (has_role(auth.uid(), 'vendedor'::app_role) AND assigned_to = auth.uid());

-- Vendedores can update leads assigned to them
CREATE POLICY "Vendedores can update assigned leads"
  ON public.leads FOR UPDATE
  USING (has_role(auth.uid(), 'vendedor'::app_role) AND assigned_to = auth.uid());

-- RLS policies for lead_activities
CREATE POLICY "Devs can manage all lead activities"
  ON public.lead_activities FOR ALL
  USING (has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "Vendedores can view activities of assigned leads"
  ON public.lead_activities FOR SELECT
  USING (
    has_role(auth.uid(), 'vendedor'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_activities.lead_id 
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Vendedores can insert activities on assigned leads"
  ON public.lead_activities FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    has_role(auth.uid(), 'vendedor'::app_role) AND 
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_activities.lead_id 
      AND leads.assigned_to = auth.uid()
    )
  );

-- Devs can insert activities
CREATE POLICY "Devs can insert lead activities"
  ON public.lead_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'dev'::app_role));

-- Update trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
