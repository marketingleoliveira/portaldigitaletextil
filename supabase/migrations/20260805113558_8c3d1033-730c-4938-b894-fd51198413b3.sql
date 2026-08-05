ALTER TABLE public.travel_expenses ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.travel_expenses RENAME COLUMN expense_date TO start_date;
ALTER TABLE public.travel_expenses ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.travel_expenses ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;