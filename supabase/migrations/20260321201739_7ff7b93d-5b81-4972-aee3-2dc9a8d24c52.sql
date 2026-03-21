
-- Create room reservations table
CREATE TABLE public.room_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_reservations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view reservations
CREATE POLICY "Authenticated users can view all reservations"
  ON public.room_reservations FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert their own reservations
CREATE POLICY "Users can insert own reservations"
  ON public.room_reservations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update own reservations
CREATE POLICY "Users can update own reservations"
  ON public.room_reservations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own reservations
CREATE POLICY "Users can delete own reservations"
  ON public.room_reservations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Devs can manage all reservations
CREATE POLICY "Devs can manage all reservations"
  ON public.room_reservations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_reservations;
