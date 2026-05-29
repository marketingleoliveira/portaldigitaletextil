
CREATE POLICY "Vendedores can insert leads"
ON public.leads FOR INSERT
WITH CHECK (has_role(auth.uid(), 'vendedor'::app_role) AND auth.uid() = created_by);
