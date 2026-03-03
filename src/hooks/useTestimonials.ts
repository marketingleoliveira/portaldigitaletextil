import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TestimonialSchedule {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  scheduled_date: string;
  notes: string | null;
  orientation_file_url: string | null;
  orientation_file_name: string | null;
  meeting_link: string | null;
  status: string;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useTestimonials = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonial_schedules')
        .select('*')
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as TestimonialSchedule[];
    },
    enabled: !!user,
  });

  const createTestimonial = useMutation({
    mutationFn: async (testimonial: {
      company_name: string;
      contact_name?: string;
      contact_phone?: string;
      scheduled_date: string;
      notes?: string;
      orientation_file_url?: string;
      orientation_file_name?: string;
      meeting_link?: string;
    }) => {
      const { data, error } = await supabase
        .from('testimonial_schedules')
        .insert({
          ...testimonial,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      toast({ title: 'Depoimento agendado com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao agendar depoimento', variant: 'destructive' });
    },
  });

  const updateTestimonial = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TestimonialSchedule> & { id: string }) => {
      const { error } = await supabase
        .from('testimonial_schedules')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      toast({ title: 'Depoimento atualizado!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    },
  });

  const deleteTestimonial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('testimonial_schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      toast({ title: 'Depoimento removido!' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    },
  });

  return {
    testimonials,
    isLoading,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
  };
};
