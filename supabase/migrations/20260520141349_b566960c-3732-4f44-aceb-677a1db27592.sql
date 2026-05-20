
-- Status enum
CREATE TYPE public.marketing_request_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.marketing_request_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Requests table
CREATE TABLE public.marketing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status public.marketing_request_status NOT NULL DEFAULT 'pendente',
  priority public.marketing_request_priority NOT NULL DEFAULT 'media',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs full access to marketing_requests"
ON public.marketing_requests FOR ALL
USING (has_role(auth.uid(), 'dev'))
WITH CHECK (has_role(auth.uid(), 'dev'));

CREATE POLICY "Marketing can view marketing_requests"
ON public.marketing_requests FOR SELECT
USING (has_role(auth.uid(), 'marketing'));

CREATE POLICY "Marketing can update status of marketing_requests"
ON public.marketing_requests FOR UPDATE
USING (has_role(auth.uid(), 'marketing'))
WITH CHECK (has_role(auth.uid(), 'marketing'));

CREATE TRIGGER trg_marketing_requests_updated_at
BEFORE UPDATE ON public.marketing_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Attachments
CREATE TABLE public.marketing_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.marketing_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs full access to marketing_request_attachments"
ON public.marketing_request_attachments FOR ALL
USING (has_role(auth.uid(), 'dev'))
WITH CHECK (has_role(auth.uid(), 'dev'));

CREATE POLICY "Marketing can view marketing_request_attachments"
ON public.marketing_request_attachments FOR SELECT
USING (has_role(auth.uid(), 'marketing'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('marketing-requests', 'marketing-requests', true);

CREATE POLICY "Public read marketing-requests"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-requests');

CREATE POLICY "Devs can upload to marketing-requests"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketing-requests' AND has_role(auth.uid(), 'dev'));

CREATE POLICY "Devs can update marketing-requests"
ON storage.objects FOR UPDATE
USING (bucket_id = 'marketing-requests' AND has_role(auth.uid(), 'dev'));

CREATE POLICY "Devs can delete marketing-requests"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketing-requests' AND has_role(auth.uid(), 'dev'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_requests;
