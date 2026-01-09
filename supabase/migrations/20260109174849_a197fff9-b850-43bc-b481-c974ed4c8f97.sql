-- Add custom_image_url field for criacao role custom profile images
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_image_url TEXT;