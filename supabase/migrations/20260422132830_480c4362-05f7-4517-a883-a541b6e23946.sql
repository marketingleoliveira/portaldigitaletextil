ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.user_notifications
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS image_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('notification-images', 'notification-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view notification images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'notification-images');

CREATE POLICY "Managers and admins can upload notification images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'notification-images'
  AND (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dev')
  )
);

CREATE POLICY "Managers and admins can update notification images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'notification-images'
  AND (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dev')
  )
)
WITH CHECK (
  bucket_id = 'notification-images'
  AND (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dev')
  )
);

CREATE POLICY "Managers and admins can delete notification images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'notification-images'
  AND (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dev')
  )
);