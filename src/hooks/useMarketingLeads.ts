import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type MarketingLeadStatus = "lead" | "contato_inicial" | "resposta" | "agendado" | "depoimento_realizado";

export interface MarketingLead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: MarketingLeadStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const MARKETING_STATUS_CONFIG: Record<MarketingLeadStatus, { label: string; color: string }> = {
  lead: { label: "Leads", color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  contato_inicial: { label: "Contato Inicial", color: "bg-sky-500/15 text-sky-700 border-sky-300" },
  resposta: { label: "Resposta", color: "bg-violet-500/15 text-violet-700 border-violet-300" },
  agendado: { label: "Agendado", color: "bg-amber-500/15 text-amber-700 border-amber-300" },
  depoimento_realizado: { label: "Depoimento Realizado", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
};

export function useMarketingLeads() {
  return useQuery({
    queryKey: ["marketing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MarketingLead[];
    },
  });
}

export function useCreateMarketingLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { company_name: string; contact_name: string; contact_email?: string; contact_phone?: string; notes?: string }) => {
      const { error } = await supabase.from("marketing_leads").insert({
        ...data,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      toast.success("Lead criado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useUpdateMarketingLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<MarketingLead> & { id: string }) => {
      const { error } = await supabase.from("marketing_leads").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      toast.success("Lead atualizado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteMarketingLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      toast.success("Lead removido!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}
