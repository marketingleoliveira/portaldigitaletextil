
CREATE OR REPLACE FUNCTION public.can_view_file(_user_id uuid, _file_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
  user_region text;
  has_role_access boolean;
  has_region_restriction boolean;
  has_region_access boolean;
BEGIN
  SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF user_role IN ('admin', 'dev', 'sdr', 'marketing') THEN
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
$$;
