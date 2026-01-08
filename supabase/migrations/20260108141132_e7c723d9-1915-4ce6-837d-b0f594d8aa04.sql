-- Create a security definer function to check if user is meeting participant
CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = _meeting_id AND user_id = _user_id AND left_at IS NULL
  )
$$;

-- Create a security definer function to check if user is meeting host
CREATE OR REPLACE FUNCTION public.is_meeting_host(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meetings
    WHERE id = _meeting_id AND host_user_id = _user_id
  )
$$;

-- Drop all existing policies on meetings
DROP POLICY IF EXISTS "Users can view meetings they are part of or public meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Hosts can update their meetings" ON public.meetings;
DROP POLICY IF EXISTS "Hosts can delete their meetings" ON public.meetings;

-- Create simplified policies without circular references
CREATE POLICY "Anyone can view active meetings or their own" 
ON public.meetings FOR SELECT 
USING (host_user_id = auth.uid() OR is_active = true);

CREATE POLICY "Authenticated users can create meetings" 
ON public.meetings FOR INSERT 
WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their meetings" 
ON public.meetings FOR UPDATE 
USING (host_user_id = auth.uid());

CREATE POLICY "Hosts can delete their meetings" 
ON public.meetings FOR DELETE 
USING (host_user_id = auth.uid());

-- Drop and recreate policies on meeting_participants using security definer functions
DROP POLICY IF EXISTS "Users can view participants of meetings they are in" ON public.meeting_participants;
DROP POLICY IF EXISTS "Users can join meetings" ON public.meeting_participants;
DROP POLICY IF EXISTS "Hosts or users can update participant status" ON public.meeting_participants;
DROP POLICY IF EXISTS "Users can leave meetings" ON public.meeting_participants;

CREATE POLICY "Users can view meeting participants" 
ON public.meeting_participants FOR SELECT 
USING (
  user_id = auth.uid() 
  OR public.is_meeting_host(meeting_id, auth.uid())
);

CREATE POLICY "Users can join meetings" 
ON public.meeting_participants FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participant status" 
ON public.meeting_participants FOR UPDATE 
USING (user_id = auth.uid() OR public.is_meeting_host(meeting_id, auth.uid()));

CREATE POLICY "Users can leave meetings" 
ON public.meeting_participants FOR DELETE 
USING (user_id = auth.uid() OR public.is_meeting_host(meeting_id, auth.uid()));