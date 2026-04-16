
CREATE TABLE public.marketing_quick_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  shortcut_key text,
  response_type text NOT NULL DEFAULT 'ligacao' CHECK (response_type IN ('ligacao', 'whatsapp')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_quick_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quick responses"
  ON public.marketing_quick_responses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert quick responses"
  ON public.marketing_quick_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their quick responses"
  ON public.marketing_quick_responses FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their quick responses"
  ON public.marketing_quick_responses FOR DELETE TO authenticated USING (auth.uid() = created_by);
