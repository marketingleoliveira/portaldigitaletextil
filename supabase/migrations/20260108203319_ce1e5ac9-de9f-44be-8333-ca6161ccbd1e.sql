-- Drop existing update policy
DROP POLICY IF EXISTS meetings_update_policy ON public.meetings;

-- Create new update policy that allows hosts OR devs/admins to update
CREATE POLICY "meetings_update_policy" 
ON public.meetings 
FOR UPDATE 
USING (
  host_user_id = auth.uid() 
  OR has_full_access(auth.uid())
);

-- Also update delete policy for consistency
DROP POLICY IF EXISTS meetings_delete_policy ON public.meetings;

CREATE POLICY "meetings_delete_policy" 
ON public.meetings 
FOR DELETE 
USING (
  host_user_id = auth.uid() 
  OR has_full_access(auth.uid())
);