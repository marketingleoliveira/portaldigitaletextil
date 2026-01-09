-- Add linkedin field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS linkedin TEXT;