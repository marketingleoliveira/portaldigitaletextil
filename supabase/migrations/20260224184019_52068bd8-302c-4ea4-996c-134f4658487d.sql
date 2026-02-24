-- SDR can view all leads
CREATE POLICY "SDR can view all leads"
ON public.leads FOR SELECT
USING (has_role(auth.uid(), 'sdr'::app_role));

-- SDR can create leads
CREATE POLICY "SDR can insert leads"
ON public.leads FOR INSERT
WITH CHECK (has_role(auth.uid(), 'sdr'::app_role) AND auth.uid() = created_by);

-- SDR can update leads
CREATE POLICY "SDR can update leads"
ON public.leads FOR UPDATE
USING (has_role(auth.uid(), 'sdr'::app_role));

-- SDR lead activities
CREATE POLICY "SDR can view lead activities"
ON public.lead_activities FOR SELECT
USING (has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "SDR can insert lead activities"
ON public.lead_activities FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'sdr'::app_role));

-- SDR lead schedules
CREATE POLICY "SDR can view lead_schedules"
ON public.lead_schedules FOR SELECT
USING (has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "SDR can insert lead_schedules"
ON public.lead_schedules FOR INSERT
WITH CHECK (auth.uid() = created_by AND has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "SDR can update lead_schedules"
ON public.lead_schedules FOR UPDATE
USING (has_role(auth.uid(), 'sdr'::app_role) AND created_by = auth.uid());

-- SDR can view all price files (all regions)
CREATE POLICY "SDR can view all price files"
ON public.price_files FOR SELECT
USING (has_role(auth.uid(), 'sdr'::app_role));

-- Update can_view_file to give SDR full access to all commercial files
CREATE OR REPLACE FUNCTION public.can_view_file(_user_id uuid, _file_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
  user_region text;
  has_role_access boolean;
  has_region_restriction boolean;
  has_region_access boolean;
BEGIN
  SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF user_role IN ('admin', 'dev', 'sdr') THEN
    RETURN true;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM file_visibility fv 
    WHERE fv.file_id = _file_id AND fv.visible_to_role = user_role
  ) INTO has_role_access;
  
  IF NOT has_role_access THEN
    RETURN false;
  END IF;
  
  IF user_role = 'vendedor' THEN
    SELECT EXISTS (
      SELECT 1 FROM file_region_visibility frv WHERE frv.file_id = _file_id
    ) INTO has_region_restriction;
    
    IF NOT has_region_restriction THEN
      RETURN true;
    END IF;
    
    SELECT region INTO user_region FROM profiles WHERE id = _user_id;
    
    IF user_region IS NULL THEN
      RETURN false;
    END IF;
    
    SELECT EXISTS (
      SELECT 1 FROM file_region_visibility frv 
      WHERE frv.file_id = _file_id AND frv.region = user_region
    ) INTO has_region_access;
    
    RETURN has_region_access;
  END IF;
  
  RETURN true;
END;
$function$;