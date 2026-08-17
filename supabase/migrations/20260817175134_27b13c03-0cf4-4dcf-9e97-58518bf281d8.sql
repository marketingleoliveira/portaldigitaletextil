DROP POLICY IF EXISTS "Update items in own reports" ON public.expense_items;
CREATE POLICY "Update items in own reports" ON public.expense_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.expense_reports r WHERE r.id = expense_items.report_id AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::app_role))));

DROP POLICY IF EXISTS "Insert items in own reports" ON public.expense_items;
CREATE POLICY "Insert items in own reports" ON public.expense_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.expense_reports r WHERE r.id = expense_items.report_id AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::app_role))));

DROP POLICY IF EXISTS "Delete items in own reports" ON public.expense_items;
CREATE POLICY "Delete items in own reports" ON public.expense_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.expense_reports r WHERE r.id = expense_items.report_id AND (r.user_id = auth.uid() OR public.has_full_access(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::app_role))));