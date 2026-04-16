import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MarketingQuickResponse {
  id: string;
  label: string;
  shortcut_key: string | null;
  response_type: "ligacao" | "whatsapp";
  created_by: string;
  created_at: string;
}

export function useMarketingQuickResponses() {
  return useQuery({
    queryKey: ["marketing-quick-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_quick_responses" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as MarketingQuickResponse[];
    },
  });
}

export function useCreateQuickResponse() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      label: string;
      shortcut_key?: string;
      response_type: "ligacao" | "whatsapp";
    }) => {
      const { error } = await supabase.from("marketing_quick_responses" as any).insert({
        ...data,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-quick-responses"] });
      toast.success("Comando criado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}

export function useDeleteQuickResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_quick_responses" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-quick-responses"] });
      toast.success("Comando removido!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });
}
