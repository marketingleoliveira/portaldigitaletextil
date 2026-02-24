
ALTER TABLE public.lead_schedules 
ADD CONSTRAINT lead_schedules_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id);
