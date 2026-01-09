-- Create table for Material Criação categories
CREATE TABLE public.creation_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Material Criação subcategories
CREATE TABLE public.creation_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES public.creation_categories(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Material Criação files
CREATE TABLE public.creation_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  category_id UUID REFERENCES public.creation_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.creation_subcategories(id) ON DELETE SET NULL,
  is_external_link BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_files ENABLE ROW LEVEL SECURITY;

-- Create function to check if user has criacao or dev role
CREATE OR REPLACE FUNCTION public.has_creation_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('criacao', 'dev')
  )
$$;

-- RLS Policies for creation_categories
CREATE POLICY "Users with creation access can view categories"
ON public.creation_categories
FOR SELECT
TO authenticated
USING (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can create categories"
ON public.creation_categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can update categories"
ON public.creation_categories
FOR UPDATE
TO authenticated
USING (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can delete categories"
ON public.creation_categories
FOR DELETE
TO authenticated
USING (public.has_creation_access(auth.uid()));

-- RLS Policies for creation_subcategories
CREATE POLICY "Users with creation access can view subcategories"
ON public.creation_subcategories
FOR SELECT
TO authenticated
USING (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can create subcategories"
ON public.creation_subcategories
FOR INSERT
TO authenticated
WITH CHECK (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can update subcategories"
ON public.creation_subcategories
FOR UPDATE
TO authenticated
USING (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can delete subcategories"
ON public.creation_subcategories
FOR DELETE
TO authenticated
USING (public.has_creation_access(auth.uid()));

-- RLS Policies for creation_files
CREATE POLICY "Users with creation access can view files"
ON public.creation_files
FOR SELECT
TO authenticated
USING (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can create files"
ON public.creation_files
FOR INSERT
TO authenticated
WITH CHECK (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can update files"
ON public.creation_files
FOR UPDATE
TO authenticated
USING (public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can delete files"
ON public.creation_files
FOR DELETE
TO authenticated
USING (public.has_creation_access(auth.uid()));

-- Create storage bucket for creation files
INSERT INTO storage.buckets (id, name, public) VALUES ('creation-files', 'creation-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for creation-files bucket
CREATE POLICY "Users with creation access can view creation files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'creation-files' AND public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can upload creation files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'creation-files' AND public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can update creation files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'creation-files' AND public.has_creation_access(auth.uid()));

CREATE POLICY "Users with creation access can delete creation files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'creation-files' AND public.has_creation_access(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_creation_categories_updated_at
BEFORE UPDATE ON public.creation_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_creation_subcategories_updated_at
BEFORE UPDATE ON public.creation_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_creation_files_updated_at
BEFORE UPDATE ON public.creation_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();