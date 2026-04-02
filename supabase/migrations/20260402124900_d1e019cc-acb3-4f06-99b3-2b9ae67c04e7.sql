
CREATE TABLE public.marketing_lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('ligacao', 'whatsapp')),
  result TEXT,
  message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing full access to contacts"
ON public.marketing_lead_contacts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role))
WITH CHECK (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role));
