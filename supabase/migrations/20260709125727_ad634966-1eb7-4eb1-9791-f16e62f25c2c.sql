ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretoria';

CREATE OR REPLACE FUNCTION public.has_full_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'dev', 'diretoria')
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role 
        OR (role::text IN ('dev','diretoria') AND _role::text = 'admin')
        OR (role::text = 'diretoria' AND _role::text = 'dev')
        OR (role::text = 'dev' AND _role::text = 'diretoria')
      )
  )
$function$;