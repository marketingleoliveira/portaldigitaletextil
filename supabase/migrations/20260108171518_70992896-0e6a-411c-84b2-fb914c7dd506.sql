
-- Add guest support to meeting_participants
ALTER TABLE public.meeting_participants 
ALTER COLUMN user_id DROP NOT NULL;

-- Add guest_name column for non-authenticated participants
ALTER TABLE public.meeting_participants 
ADD COLUMN guest_name TEXT;

-- Add guest_id for tracking guests (generated UUID)
ALTER TABLE public.meeting_participants 
ADD COLUMN guest_id UUID;

-- Add constraint: either user_id or guest_name must be set
ALTER TABLE public.meeting_participants 
ADD CONSTRAINT check_user_or_guest 
CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL);

-- Update RLS policies to allow guests to join
DROP POLICY IF EXISTS "Users can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Anyone can view meeting participants"
ON public.meeting_participants FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can join meetings" ON public.meeting_participants;
CREATE POLICY "Anyone can join meetings"
ON public.meeting_participants FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their participant status" ON public.meeting_participants;
CREATE POLICY "Anyone can update their participant status"
ON public.meeting_participants FOR UPDATE
USING (true);

-- Allow guests to send messages (add guest support)
ALTER TABLE public.meeting_messages 
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.meeting_messages 
ADD COLUMN guest_name TEXT;

ALTER TABLE public.meeting_messages 
ADD COLUMN guest_id UUID;

-- Update meeting_messages RLS for guests
DROP POLICY IF EXISTS "Users can view messages in meetings they participate" ON public.meeting_messages;
CREATE POLICY "Anyone can view meeting messages"
ON public.meeting_messages FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can send messages in meetings" ON public.meeting_messages;
CREATE POLICY "Anyone can send meeting messages"
ON public.meeting_messages FOR INSERT
WITH CHECK (true);
