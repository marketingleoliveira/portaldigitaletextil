-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view meetings they are part of or public meetings" ON public.meetings;

-- Create corrected policy without recursion
CREATE POLICY "Users can view meetings they are part of or public meetings" 
ON public.meetings 
FOR SELECT 
USING (
  host_user_id = auth.uid() 
  OR is_active = true
  OR EXISTS (
    SELECT 1 FROM meeting_participants mp 
    WHERE mp.meeting_id = meetings.id AND mp.user_id = auth.uid()
  )
);