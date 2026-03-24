import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface LeadReminder {
  id: string;
  lead_id: string;
  created_by: string;
  reminder_date: string;
  description: string;
  completed_at: string | null;
  created_at: string;
  created_by_profile?: { full_name: string } | null;
}

export function useLeadReminders(leadId?: string) {
  return useQuery({
    queryKey: ["lead-reminders", leadId],
    queryFn: async () => {
      let query = supabase
        .from("lead_reminders")
        .select("*, created_by_profile:profiles!lead_reminders_created_by_fkey(full_name)")
        .order("reminder_date", { ascending: true });

      if (leadId) {
        query = query.eq("lead_id", leadId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as LeadReminder[];
    },
    enabled: leadId ? !!leadId : true,
  });
}

export function usePendingReminders() {
  return useQuery({
    queryKey: ["lead-reminders-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_reminders")
        .select("*, created_by_profile:profiles!lead_reminders_created_by_fkey(full_name)")
        .is("completed_at", null)
        .lte("reminder_date", new Date().toISOString())
        .order("reminder_date", { ascending: true });
      if (error) throw error;
      return data as unknown as LeadReminder[];
    },
    refetchInterval: 60000,
  });
}

export function useCreateLeadReminder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { lead_id: string; reminder_date: string; description: string }) => {
      const { error } = await supabase.from("lead_reminders").insert({
        lead_id: data.lead_id,
        reminder_date: data.reminder_date,
        description: data.description,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["lead-reminders-pending"] });
      toast.success("Lembrete criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar lembrete: " + err.message);
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from("lead_reminders")
        .update({ completed_at: new Date().toISOString() } as any)
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["lead-reminders-pending"] });
      toast.success("Lembrete concluído!");
    },
    onError: (err: any) => {
      toast.error("Erro: " + err.message);
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from("lead_reminders")
        .delete()
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["lead-reminders-pending"] });
      toast.success("Lembrete removido!");
    },
    onError: (err: any) => {
      toast.error("Erro: " + err.message);
    },
  });
}
