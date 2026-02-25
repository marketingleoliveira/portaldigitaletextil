
-- Create testimonial_schedules table for depoimentos
CREATE TABLE public.testimonial_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  contact_phone text,
  scheduled_date timestamp with time zone NOT NULL,
  notes text,
  orientation_file_url text,
  orientation_file_name text,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonial_schedules ENABLE ROW LEVEL SECURITY;

-- Marketing and dev full access
CREATE POLICY "Marketing can view testimonials" ON public.testimonial_schedules
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "Marketing can insert testimonials" ON public.testimonial_schedules
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role)) AND auth.uid() = created_by);

CREATE POLICY "Marketing can update testimonials" ON public.testimonial_schedules
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role));

CREATE POLICY "Dev can delete testimonials" ON public.testimonial_schedules
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'dev'::app_role));

-- Storage bucket for orientation files
INSERT INTO storage.buckets (id, name, public) VALUES ('testimonial-files', 'testimonial-files', true);

-- Storage policies
CREATE POLICY "Marketing can upload testimonial files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'testimonial-files' AND (has_role(auth.uid(), 'marketing'::app_role) OR has_role(auth.uid(), 'dev'::app_role)));

CREATE POLICY "Anyone can view testimonial files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'testimonial-files');

-- Update has_creation_access to include marketing
CREATE OR REPLACE FUNCTION public.has_creation_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('criacao', 'dev', 'marketing')
  )
$$;

-- Update get_user_role to include marketing
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'dev' THEN 0
      WHEN 'admin' THEN 1 
      WHEN 'gerente' THEN 2 
      WHEN 'vendedor' THEN 3
      WHEN 'marketing' THEN 4
      WHEN 'sdr' THEN 5
    END
  LIMIT 1
$$;

-- Enable realtime for testimonial_schedules
ALTER PUBLICATION supabase_realtime ADD TABLE public.testimonial_schedules;
