
CREATE TABLE public.lead_service_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  start_latitude DOUBLE PRECISION,
  start_longitude DOUBLE PRECISION,
  start_address TEXT,
  start_accuracy DOUBLE PRECISION,
  end_latitude DOUBLE PRECISION,
  end_longitude DOUBLE PRECISION,
  end_address TEXT,
  end_accuracy DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_service_sessions_lead ON public.lead_service_sessions(lead_id);
CREATE INDEX idx_lead_service_sessions_user ON public.lead_service_sessions(user_id);
CREATE INDEX idx_lead_service_sessions_open ON public.lead_service_sessions(lead_id, user_id) WHERE ended_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_service_sessions TO authenticated;
GRANT ALL ON public.lead_service_sessions TO service_role;

ALTER TABLE public.lead_service_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs full access to lead_service_sessions"
ON public.lead_service_sessions FOR ALL
USING (has_role(auth.uid(), 'dev'::app_role))
WITH CHECK (has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "SDR can view all sessions"
ON public.lead_service_sessions FOR SELECT
USING (has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "Vendedores can view own sessions"
ON public.lead_service_sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
ON public.lead_service_sessions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own open sessions"
ON public.lead_service_sessions FOR UPDATE
USING (user_id = auth.uid());

CREATE TRIGGER set_lead_service_sessions_updated_at
BEFORE UPDATE ON public.lead_service_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
