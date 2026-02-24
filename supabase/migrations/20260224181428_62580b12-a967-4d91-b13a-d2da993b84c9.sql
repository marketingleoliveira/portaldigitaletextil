
-- Add completed_at column to lead_schedules for marking as "Realizado"
ALTER TABLE public.lead_schedules 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
