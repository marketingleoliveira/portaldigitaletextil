-- Drop and recreate update policy with WITH CHECK
DROP POLICY IF EXISTS meetings_update_policy ON public.meetings;

CREATE POLICY "meetings_update_policy" 
ON public.meetings 
FOR UPDATE 
USING (
  host_user_id = auth.uid() 
  OR has_full_access(auth.uid())
)
WITH CHECK (
  host_user_id = auth.uid() 
  OR has_full_access(auth.uid())
);