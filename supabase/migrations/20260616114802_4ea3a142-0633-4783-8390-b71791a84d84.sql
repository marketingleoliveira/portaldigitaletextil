
-- Reimbursement reports
CREATE TABLE public.expense_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trip_destination TEXT,
  trip_start_date DATE,
  trip_end_date DATE,
  company_advance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reports TO authenticated;
GRANT ALL ON public.expense_reports TO service_role;

ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own expense reports"
  ON public.expense_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_full_access(auth.uid()) OR public.has_role(auth.uid(), 'gerente'));

CREATE POLICY "Users create own expense reports"
  ON public.expense_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own expense reports"
  ON public.expense_reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_full_access(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.has_full_access(auth.uid()));

CREATE POLICY "Users delete own expense reports"
  ON public.expense_reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_full_access(auth.uid()));

CREATE TRIGGER trg_expense_reports_updated_at
  BEFORE UPDATE ON public.expense_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Expense items per report
CREATE TABLE public.expense_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.expense_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE,
  receipt_url TEXT,
  receipt_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_items TO authenticated;
GRANT ALL ON public.expense_items TO service_role;

ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View items of accessible reports"
  ON public.expense_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expense_reports r
    WHERE r.id = expense_items.report_id
      AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()) OR public.has_role(auth.uid(), 'gerente'))
  ));

CREATE POLICY "Insert items in own reports"
  ON public.expense_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expense_reports r
    WHERE r.id = expense_items.report_id
      AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()))
  ));

CREATE POLICY "Update items in own reports"
  ON public.expense_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expense_reports r
    WHERE r.id = expense_items.report_id
      AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()))
  ));

CREATE POLICY "Delete items in own reports"
  ON public.expense_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expense_reports r
    WHERE r.id = expense_items.report_id
      AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()))
  ));

CREATE INDEX idx_expense_reports_user ON public.expense_reports(user_id, created_at DESC);
CREATE INDEX idx_expense_items_report ON public.expense_items(report_id);
