-- Create storage bucket for meeting recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-recordings', 'meeting-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload recordings
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meeting-recordings');

-- Create policy for authenticated users to view recordings
CREATE POLICY "Authenticated users can view recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'meeting-recordings');

-- Create policy for devs to delete recordings
CREATE POLICY "Devs can delete recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'meeting-recordings' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'dev'
  )
);