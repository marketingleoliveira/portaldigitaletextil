-- Update expense_reports SELECT to include financeiro
DROP POLICY IF EXISTS "Users view own expense reports" ON public.expense_reports;
CREATE POLICY "Users view own expense reports"
ON public.expense_reports FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_full_access(auth.uid())
  OR public.has_role(auth.uid(), 'gerente'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
);

-- Update expense_reports UPDATE to include financeiro
DROP POLICY IF EXISTS "Users update own expense reports" ON public.expense_reports;
CREATE POLICY "Users update own expense reports"
ON public.expense_reports FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.has_full_access(auth.uid())
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_full_access(auth.uid())
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
);

-- Update expense_items SELECT to include financeiro
DROP POLICY IF EXISTS "View items of accessible reports" ON public.expense_items;
CREATE POLICY "View items of accessible reports"
ON public.expense_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.expense_reports r
    WHERE r.id = expense_items.report_id
      AND (
        r.user_id = auth.uid()
        OR public.has_full_access(auth.uid())
        OR public.has_role(auth.uid(), 'gerente'::app_role)
        OR public.has_role(auth.uid(), 'financeiro'::app_role)
      )
  )
);