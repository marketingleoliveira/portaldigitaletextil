DROP POLICY IF EXISTS "Devs can manage all reservations" ON public.room_reservations;
CREATE POLICY "Admin roles can manage all reservations"
ON public.room_reservations
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'dev'::app_role)
  OR public.has_role(auth.uid(), 'diretoria'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'dev'::app_role)
  OR public.has_role(auth.uid(), 'diretoria'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
);