DROP POLICY IF EXISTS "Users view own activity sessions" ON public.user_activity_sessions;

CREATE POLICY "Authenticated users can view all activity sessions"
ON public.user_activity_sessions
FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.can_view_product(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role::text IN ('admin', 'dev', 'diretoria', 'gerente', 'marketing', 'sdr')
        OR EXISTS (
          SELECT 1 FROM public.product_visibility pv
          WHERE pv.product_id = _product_id
            AND (pv.visible_to_role = ur.role)
        )
      )
  )
$function$;