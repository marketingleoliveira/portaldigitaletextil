import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MarketingContact {
  id: string;
  lead_id: string;
  contact_type: "ligacao" | "whatsapp";
  result: string | null;
  message: string | null;
  created_by: string;
  created_at: string;
}

export function useMarketingContacts(leadId?: string) {
  return useQuery({
    queryKey: ["marketing-contacts", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_lead_contacts" as any)
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MarketingContact[];
    },
  });
}

export function useAllMarketingContacts() {
  return useQuery({
    queryKey: ["marketing-contacts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_lead_contacts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MarketingContact[];
    },
  });
}

export function useCreateMarketingContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      lead_id: string;
      contact_type: "ligacao" | "whatsapp";
      result?: string;
      message?: string;
    }) => {
      const { error } = await supabase.from("marketing_lead_contacts" as any).insert({
        ...data,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts", vars.lead_id] });
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts-all"] });
      toast.success("Contato registrado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}
