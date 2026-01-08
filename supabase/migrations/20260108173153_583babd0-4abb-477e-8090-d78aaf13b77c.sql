-- Create table for meeting recordings
CREATE TABLE public.meeting_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  meeting_title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  recording_id TEXT NOT NULL UNIQUE,
  download_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Enable RLS
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;

-- Only devs can view recordings
CREATE POLICY "Devs can view all recordings" 
ON public.meeting_recordings 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'dev'));

-- Allow service role to insert (edge functions)
CREATE POLICY "Service role can insert recordings"
ON public.meeting_recordings
FOR INSERT
WITH CHECK (true);

-- Allow service role to update (edge functions)
CREATE POLICY "Service role can update recordings"
ON public.meeting_recordings
FOR UPDATE
USING (true);

-- Create indexes for filtering
CREATE INDEX idx_meeting_recordings_meeting_date ON public.meeting_recordings(meeting_date);
CREATE INDEX idx_meeting_recordings_expires_at ON public.meeting_recordings(expires_at);

-- Create function to cleanup expired recordings (can be called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_recordings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.meeting_recordings WHERE expires_at < now();
END;
$$;