DROP POLICY IF EXISTS "Authenticated users can view all activity sessions" ON public.user_activity_sessions;
CREATE POLICY "Users view own activity sessions"
  ON public.user_activity_sessions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dev'::app_role)
  );