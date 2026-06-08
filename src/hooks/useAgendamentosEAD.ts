import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgendamentosLead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  source: string;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  assigned_profile?: { full_name: string; avatar_url: string | null } | null;
}

export interface LeadWithReminder {
  reminder_id: string;
  reminder_date: string;
  description: string;
  completed_at: string | null;
  lead: AgendamentosLead;
}

export function useTrophyLeads(scope: 'atendimento' | 'crm' = 'atendimento') {
  return useQuery({
    queryKey: ["agendamentos-trophy-leads", scope],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("*, assigned_profile:profiles!leads_assigned_to_fkey(full_name, avatar_url)")
        .eq("status", "ganho")
        .eq("scope", scope)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return data as unknown as AgendamentosLead[];
    },
  });
}

export function useReminderLeads(scope: 'atendimento' | 'crm' = 'atendimento') {
  return useQuery({
    queryKey: ["agendamentos-reminder-leads", scope],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_reminders")
        .select(
          `id, reminder_date, description, completed_at, lead_id, created_by, created_at,
           lead:leads!inner(*, assigned_profile:profiles!leads_assigned_to_fkey(full_name, avatar_url)),
           created_by_profile:profiles!lead_reminders_created_by_fkey(full_name)`
        )
        .eq("lead.scope", scope)
        .is("completed_at", null)
        .order("reminder_date", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        reminder_id: r.id,
        reminder_date: r.reminder_date,
        description: r.description,
        completed_at: r.completed_at,
        lead: r.lead as AgendamentosLead,
      })) as LeadWithReminder[];
    },
  });
}

