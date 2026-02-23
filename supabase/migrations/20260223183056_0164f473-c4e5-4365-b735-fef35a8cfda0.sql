
ALTER TABLE public.lead_activities
ADD CONSTRAINT lead_activities_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);
