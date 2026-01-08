-- Create meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_code TEXT NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  allow_participants_video BOOLEAN DEFAULT true,
  allow_participants_audio BOOLEAN DEFAULT true,
  allow_screen_share BOOLEAN DEFAULT true,
  allow_chat BOOLEAN DEFAULT true,
  waiting_room_enabled BOOLEAN DEFAULT false,
  max_participants INTEGER DEFAULT 50,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting participants table
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_host BOOLEAN DEFAULT false,
  is_co_host BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  is_video_on BOOLEAN DEFAULT true,
  is_screen_sharing BOOLEAN DEFAULT false,
  is_hand_raised BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(meeting_id, user_id)
);

-- Create meeting chat messages table
CREATE TABLE public.meeting_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for meetings
CREATE POLICY "Users can view meetings they are part of or public meetings"
ON public.meetings FOR SELECT
USING (
  host_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meeting_participants mp 
    WHERE mp.meeting_id = id AND mp.user_id = auth.uid()
  ) OR
  is_active = true
);

CREATE POLICY "Users can create meetings"
ON public.meetings FOR INSERT
WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their meetings"
ON public.meetings FOR UPDATE
USING (host_user_id = auth.uid());

CREATE POLICY "Hosts can delete their meetings"
ON public.meetings FOR DELETE
USING (host_user_id = auth.uid());

-- RLS policies for meeting participants
CREATE POLICY "Users can view participants of meetings they are in"
ON public.meeting_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.host_user_id = auth.uid() OR m.is_active = true)
  )
);

CREATE POLICY "Users can join meetings"
ON public.meeting_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts or users can update participant status"
ON public.meeting_participants FOR UPDATE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND m.host_user_id = auth.uid()
  )
);

CREATE POLICY "Users can leave meetings"
ON public.meeting_participants FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND m.host_user_id = auth.uid()
  )
);

-- RLS policies for meeting messages
CREATE POLICY "Users can view messages in meetings they are part of"
ON public.meeting_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meeting_participants mp 
    WHERE mp.meeting_id = meeting_id AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in meetings they are part of"
ON public.meeting_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.meeting_participants mp 
    WHERE mp.meeting_id = meeting_id AND mp.user_id = auth.uid()
  )
);

-- Enable realtime for meetings
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_messages;

-- Create function to generate meeting code
CREATE OR REPLACE FUNCTION public.generate_meeting_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate format: xxx-xxxx-xxx (like Google Meet)
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * 26 + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * 26 + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * 26 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for updated_at using existing function
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();