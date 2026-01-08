-- Remove ALL policies from meetings table
DROP POLICY IF EXISTS "Anyone can view active meetings or their own" ON public.meetings;
DROP POLICY IF EXISTS "Authenticated users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Hosts can update their meetings" ON public.meetings;
DROP POLICY IF EXISTS "Hosts can delete their meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view meetings they are part of or public meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;

-- Remove ALL policies from meeting_participants table  
DROP POLICY IF EXISTS "Users can view meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Users can join meetings" ON public.meeting_participants;
DROP POLICY IF EXISTS "Users can update their own participant status" ON public.meeting_participants;
DROP POLICY IF EXISTS "Users can leave meetings" ON public.meeting_participants;
DROP POLICY IF EXISTS "Users can view participants of meetings they are in" ON public.meeting_participants;
DROP POLICY IF EXISTS "Hosts or users can update participant status" ON public.meeting_participants;

-- Create simple policies for meetings (no recursion)
CREATE POLICY "meetings_select_policy" ON public.meetings 
FOR SELECT USING (host_user_id = auth.uid() OR is_active = true);

CREATE POLICY "meetings_insert_policy" ON public.meetings 
FOR INSERT WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "meetings_update_policy" ON public.meetings 
FOR UPDATE USING (host_user_id = auth.uid());

CREATE POLICY "meetings_delete_policy" ON public.meetings 
FOR DELETE USING (host_user_id = auth.uid());

-- Create simple policies for meeting_participants (using security definer function)
CREATE POLICY "participants_select_policy" ON public.meeting_participants 
FOR SELECT USING (user_id = auth.uid() OR public.is_meeting_host(meeting_id, auth.uid()));

CREATE POLICY "participants_insert_policy" ON public.meeting_participants 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "participants_update_policy" ON public.meeting_participants 
FOR UPDATE USING (user_id = auth.uid() OR public.is_meeting_host(meeting_id, auth.uid()));

CREATE POLICY "participants_delete_policy" ON public.meeting_participants 
FOR DELETE USING (user_id = auth.uid() OR public.is_meeting_host(meeting_id, auth.uid()));