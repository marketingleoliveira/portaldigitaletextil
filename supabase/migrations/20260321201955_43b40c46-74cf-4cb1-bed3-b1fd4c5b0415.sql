
-- Add foreign key to room_reservations for user_id
ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
