-- Allow admins to view recordings as well
CREATE POLICY "Admins can view all recordings"
ON public.meeting_recordings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow authenticated users to insert recordings (for local recordings)
CREATE POLICY "Authenticated users can insert recordings"
ON public.meeting_recordings
FOR INSERT
TO authenticated
WITH CHECK (true);