import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type MarketingRequestStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type MarketingRequestPriority = "baixa" | "media" | "alta" | "urgente";

export interface MarketingRequestAttachment {
  id: string;
  request_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface MarketingRequest {
  id: string;
  title: string;
  description: string | null;
  status: MarketingRequestStatus;
  priority: MarketingRequestPriority;
  start_date: string;
  due_date: string;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number;
  attachments?: MarketingRequestAttachment[];
  creator?: { full_name: string; avatar_url: string | null } | null;
}

export const STATUS_LABELS: Record<MarketingRequestStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_COLORS: Record<MarketingRequestStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  em_andamento: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
  concluida: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  cancelada: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30 dark:text-zinc-400",
};

export const PRIORITY_LABELS: Record<MarketingRequestPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_COLORS: Record<MarketingRequestPriority, string> = {
  baixa: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-300",
  media: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-400",
  alta: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400",
  urgente: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
};

export function useMarketingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MarketingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data: rs, error } = await supabase
      .from("marketing_requests")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("due_date", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar solicitações", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = (rs ?? []).map((r) => r.id);
    let atts: MarketingRequestAttachment[] = [];
    if (ids.length) {
      const { data: a } = await supabase
        .from("marketing_request_attachments")
        .select("*")
        .in("request_id", ids);
      atts = (a ?? []) as MarketingRequestAttachment[];
    }
    const creatorIds = Array.from(new Set((rs ?? []).map((r) => r.created_by)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", creatorIds.length ? creatorIds : ["00000000-0000-0000-0000-000000000000"]);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    setRequests(
      (rs ?? []).map((r) => ({
        ...(r as MarketingRequest),
        attachments: atts.filter((x) => x.request_id === r.id),
        creator: (pmap.get(r.created_by) as any) ?? null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    const ch = supabase
      .channel("marketing_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_requests" }, () => fetchRequests())
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_request_attachments" }, () => fetchRequests())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchRequests]);

  const createRequest = async (input: {
    title: string;
    description: string;
    start_date: string;
    due_date: string;
    priority: MarketingRequestPriority;
  }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("marketing_requests")
      .insert({ ...input, created_by: user.id })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar solicitação", description: error.message, variant: "destructive" });
      return null;
    }
    return data;
  };

  const updateStatus = async (id: string, status: MarketingRequestStatus) => {
    const patch: any = { status };
    if (status === "concluida") patch.completed_at = new Date().toISOString();
    else patch.completed_at = null;
    const { error } = await supabase.from("marketing_requests").update(patch).eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    else toast({ title: "Status atualizado" });
  };

  const updateRequest = async (id: string, patch: Partial<MarketingRequest>) => {
    const { error } = await supabase.from("marketing_requests").update(patch as any).eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
  };

  const deleteRequest = async (id: string) => {
    const { error } = await supabase.from("marketing_requests").delete().eq("id", id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else toast({ title: "Solicitação excluída" });
  };

  const uploadAttachment = async (requestId: string, file: File) => {
    if (!user) return;
    const path = `${requestId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("marketing-requests").upload(path, file);
    if (upErr) {
      toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: pub } = supabase.storage.from("marketing-requests").getPublicUrl(path);
    const { error } = await supabase.from("marketing_request_attachments").insert({
      request_id: requestId,
      file_name: file.name,
      file_url: pub.publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    });
    if (error) toast({ title: "Erro ao salvar anexo", description: error.message, variant: "destructive" });
  };

  const deleteAttachment = async (id: string) => {
    const { error } = await supabase.from("marketing_request_attachments").delete().eq("id", id);
    if (error) toast({ title: "Erro ao excluir anexo", description: error.message, variant: "destructive" });
  };

  const reorderRequests = async (orderedIds: string[]) => {
    // Optimistic update
    setRequests((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      return orderedIds.map((id, idx) => ({ ...(map.get(id) as MarketingRequest), sort_order: idx }));
    });
    const updates = orderedIds.map((id, idx) =>
      supabase.from("marketing_requests").update({ sort_order: idx }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error)?.error;
    if (err) toast({ title: "Erro ao reordenar", description: err.message, variant: "destructive" });
  };

  return {
    requests,
    loading,
    createRequest,
    updateStatus,
    updateRequest,
    deleteRequest,
    uploadAttachment,
    deleteAttachment,
    reorderRequests,
    refetch: fetchRequests,
  };
}

/** Reminder hook: toast for marketing about due-soon / overdue requests */
export function useMarketingRequestReminders(requests: MarketingRequest[]) {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.role !== "marketing") return;
    if (!requests.length) return;
    const now = Date.now();
    const dueSoon = requests.filter((r) => {
      if (r.status === "concluida" || r.status === "cancelada") return false;
      const due = new Date(r.due_date).getTime();
      const diff = due - now;
      return diff > 0 && diff < 24 * 60 * 60 * 1000;
    });
    const overdue = requests.filter((r) => {
      if (r.status === "concluida" || r.status === "cancelada") return false;
      return new Date(r.due_date).getTime() < now;
    });
    if (overdue.length) {
      toast({
        title: `⚠️ ${overdue.length} solicitação(ões) atrasada(s)`,
        description: "Verifique o módulo Solicitações para cumprir as tarefas.",
        variant: "destructive",
      });
    } else if (dueSoon.length) {
      toast({
        title: `⏰ ${dueSoon.length} solicitação(ões) vencendo em 24h`,
        description: "Acesse Solicitações para atender no prazo.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, requests.length]);
}
