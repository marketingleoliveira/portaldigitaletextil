CREATE TABLE IF NOT EXISTS public.travel_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL DEFAULT 'viagem',
    description TEXT,
    receipt_path TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS and Grants
ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_expenses TO authenticated;
GRANT ALL ON public.travel_expenses TO service_role;

-- Policies
CREATE POLICY "Users can view their own travel expenses"
    ON public.travel_expenses FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Privileged roles can view all travel expenses"
    ON public.travel_expenses FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev') OR public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretoria') OR public.has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Users can insert their own travel expenses"
    ON public.travel_expenses FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Financeiro can insert travel expenses for any user"
    ON public.travel_expenses FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'dev') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Users can update their own travel expenses"
    ON public.travel_expenses FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Financeiro level can update any travel expense"
    ON public.travel_expenses FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'dev') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria') OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Users can delete their own travel expenses"
    ON public.travel_expenses FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Financeiro level can delete any travel expense"
    ON public.travel_expenses FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'dev') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretoria') OR public.has_role(auth.uid(), 'gerente'));
