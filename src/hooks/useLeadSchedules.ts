import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface LeadSchedule {
  id: string;
  lead_id: string;
  meeting_id: string | null;
  scheduled_date: string;
  title: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  lead?: {
    company_name: string;
    contact_name: string;
    contact_phone: string | null;
    contact_email: string | null;
    status: string;
    assigned_profile?: { full_name: string; avatar_url: string | null } | null;
  } | null;
  meeting?: {
    meeting_code: string;
    is_active: boolean;
    title: string;
  } | null;
  created_by_profile?: { full_name: string } | null;
}

export function useLeadSchedules() {
  return useQuery({
    queryKey: ["lead-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_schedules")
        .select(`
          *,
          lead:leads(company_name, contact_name, contact_phone, contact_email, status, assigned_profile:profiles!leads_assigned_to_fkey(full_name, avatar_url)),
          meeting:meetings(meeting_code, is_active, title),
          created_by_profile:profiles!lead_schedules_created_by_fkey(full_name)
        `)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as unknown as LeadSchedule[];
    },
  });
}

export function useLeadSchedulesByLead(leadId: string) {
  return useQuery({
    queryKey: ["lead-schedules", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_schedules")
        .select(`
          *,
          meeting:meetings(meeting_code, is_active, title),
          created_by_profile:profiles!lead_schedules_created_by_fkey(full_name)
        `)
        .eq("lead_id", leadId)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data as unknown as LeadSchedule[];
    },
    enabled: !!leadId,
  });
}

interface CreateScheduleData {
  lead_id: string;
  scheduled_date: string;
  title: string;
  notes?: string;
}

export function useCreateLeadSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateScheduleData) => {
      // 1. Create the meeting
      const meetingCode = generateMeetingCode();
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          title: data.title,
          meeting_code: meetingCode,
          host_user_id: user!.id,
          scheduled_start: data.scheduled_date,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // 2. Create the lead schedule linking lead to meeting
      const { error: scheduleError } = await supabase
        .from("lead_schedules")
        .insert({
          lead_id: data.lead_id,
          meeting_id: meeting.id,
          scheduled_date: data.scheduled_date,
          title: data.title,
          notes: data.notes || null,
          created_by: user!.id,
        });

      if (scheduleError) throw scheduleError;

      // 3. Move lead to "proposta" (Reunião column)
      await supabase
        .from("leads")
        .update({ status: "proposta" as any })
        .eq("id", data.lead_id);

      // 4. Log activity on the lead
      await supabase.from("lead_activities").insert({
        lead_id: data.lead_id,
        user_id: user!.id,
        activity_type: "meeting",
        description: `Reunião agendada: ${data.title}`,
      });

      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activities"] });
      toast.success("Reunião agendada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao agendar reunião: " + err.message);
    },
  });
}

function generateMeetingCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * 26));
  result += "-";
  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * 26));
  result += "-";
  for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * 26));
  return result;
}
