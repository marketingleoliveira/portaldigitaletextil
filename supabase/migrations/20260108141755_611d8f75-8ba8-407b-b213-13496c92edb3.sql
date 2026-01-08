-- Add password column to meetings table
ALTER TABLE public.meetings 
ADD COLUMN password TEXT DEFAULT NULL;