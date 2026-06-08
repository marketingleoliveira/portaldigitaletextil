import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type LeadStatus = 'novo' | 'fora_de_perfil' | 'contatado' | 'qualificado' | 'proposta' | 'negociacao' | 'ganho' | 'perdido';
export type LeadSource = 'indicacao' | 'site' | 'telefone' | 'email' | 'rede_social' | 'evento' | 'outro';

export interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: LeadStatus;
  source: LeadSource;
  estimated_value: number;
  notes: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
  expected_close_date: string | null;
  assigned_profile?: { full_name: string; avatar_url: string | null } | null;
  created_by_profile?: { full_name: string } | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  description: string;
  previous_status: LeadStatus | null;
  new_status: LeadStatus | null;
  created_at: string;
  user_profile?: { full_name: string } | null;
}

export interface CreateLeadData {
  company_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  source: LeadSource;
  estimated_value?: number;
  notes?: string;
  assigned_to?: string;
  expected_close_date?: string;
}

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  novo: { label: "Prospectados", color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  fora_de_perfil: { label: "Fora de Perfil", color: "bg-gray-500/15 text-gray-700 border-gray-300" },
  contatado: { label: "Em Contato", color: "bg-sky-500/15 text-sky-700 border-sky-300" },
  qualificado: { label: "Qualificado", color: "bg-violet-500/15 text-violet-700 border-violet-300" },
  proposta: { label: "Reunião", color: "bg-amber-500/15 text-amber-700 border-amber-300" },
  negociacao: { label: "Negociação", color: "bg-orange-500/15 text-orange-700 border-orange-300" },
  ganho: { label: "Ganho", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  perdido: { label: "Perdido", color: "bg-red-500/15 text-red-700 border-red-300" },
};

export const LEAD_SOURCE_CONFIG: Record<LeadSource, string> = {
  indicacao: "Indicação",
  site: "Site",
  telefone: "Telefone",
  email: "E-mail",
  rede_social: "Rede Social",
  evento: "Evento",
  outro: "Outro",
};

export type LeadScope = 'crm' | 'atendimento';

export function useLeads(statusFilter?: LeadStatus | null, scope: LeadScope = 'atendimento') {
  return useQuery({
    queryKey: ["leads", statusFilter, scope],
    queryFn: async () => {
      let query: any = supabase
        .from("leads")
        .select("*, assigned_profile:profiles!leads_assigned_to_fkey(full_name, avatar_url)")
        .eq("scope", scope)
        .order("created_at", { ascending: false });


      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Lead[];
    },
  });
}


export function useLeadActivities(leadId: string) {
  return useQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*, user_profile:profiles!lead_activities_user_id_fkey(full_name)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LeadActivity[];
    },
    enabled: !!leadId,
  });
}

export function useVendedores() {
  return useQuery({
    queryKey: ["vendedores-for-crm"],
    queryFn: async () => {
      // First get roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["vendedor", "dev", "sdr", "gerente"]);
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r) => r.user_id);

      // Then get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, region, is_active")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return roles
        .filter((r) => {
          const profile = profileMap.get(r.user_id);
          return profile && profile.is_active !== false;
        })
        .map((r) => {
          const profile = profileMap.get(r.user_id)!;
          return {
            id: r.user_id,
            full_name: profile.full_name || "Sem nome",
            avatar_url: profile.avatar_url,
            role: r.role,
            region: profile.region,
          };
        });
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateLeadData & { scope?: LeadScope }) => {
      const scope = data.scope || 'atendimento';
      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({
          ...data,
          scope,
          created_by: user!.id,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // If created in CRM with a vendor assigned, duplicate to Atendimento EAD
      if (scope === 'crm' && data.assigned_to && inserted) {
        const curr = inserted as any;
        const dup: any = {
          company_name: curr.company_name,
          contact_name: curr.contact_name,
          contact_email: curr.contact_email,
          contact_phone: curr.contact_phone,
          source: curr.source,
          estimated_value: curr.estimated_value,
          notes: curr.notes,
          cnpj: curr.cnpj,
          razao_social: curr.razao_social,
          categoria: curr.categoria,
          setor: curr.setor,
          responsavel: curr.responsavel,
          compra_tecido_mensal: curr.compra_tecido_mensal,
          rua: curr.rua,
          bairro: curr.bairro,
          cep: curr.cep,
          expected_close_date: curr.expected_close_date,
          status: curr.status || 'novo',
          scope: 'atendimento',
          source_lead_id: curr.id,
          assigned_to: data.assigned_to,
          created_by: user!.id,
        };
        await supabase.from("leads").insert(dup);

        await supabase.from("user_notifications").insert({
          target_user_id: data.assigned_to,
          created_by: user!.id,
          title: "Novo lead atribuído a você",
          message: `O lead "${curr.company_name}" foi atribuído a você. Acesse o Atendimento EAD para mais detalhes.`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar lead: " + err.message);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Lead> & { id: string }) => {
      // Get current lead for status change and assignment tracking
      const { data: currentLead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("leads").update(data).eq("id", id);
      if (error) throw error;

      // Log status change activity
      if (data.status && currentLead && currentLead.status !== data.status) {
        await supabase.from("lead_activities").insert({
          lead_id: id,
          user_id: user!.id,
          activity_type: "status_change",
          description: `Status alterado de ${LEAD_STATUS_CONFIG[currentLead.status as LeadStatus]?.label} para ${LEAD_STATUS_CONFIG[data.status]?.label}`,
          previous_status: currentLead.status,
          new_status: data.status,
        });
      }

      // Handle unassignment: remove vendor's duplicate from Atendimento EAD
      if (currentLead && (currentLead as any).scope === 'crm'
          && 'assigned_to' in data && !data.assigned_to && (currentLead as any).assigned_to) {
        await (supabase as any)
          .from("leads")
          .delete()
          .eq("source_lead_id", id)
          .eq("assigned_to", (currentLead as any).assigned_to)
          .eq("scope", "atendimento");
      }

      // Notify vendor when assigned
      if (data.assigned_to && currentLead && data.assigned_to !== currentLead.assigned_to) {
        const leadName = currentLead.company_name || "Lead";
        await supabase.from("user_notifications").insert({
          target_user_id: data.assigned_to,
          created_by: user!.id,
          title: "Novo lead atribuído a você",
          message: `O lead "${leadName}" foi atribuído a você. Acesse o Atendimento EAD para mais detalhes.`,
        });

        // CRM feeder: duplicate to Atendimento EAD scope so the vendor can work it
        const curr = currentLead as any;
        if (curr.scope === 'crm') {
          // Check if a duplicate already exists for this vendor
          const { data: existing } = await (supabase as any)
            .from("leads")
            .select("id")
            .eq("source_lead_id", id)
            .eq("assigned_to", data.assigned_to)
            .maybeSingle();


          if (!existing) {
            const dup: any = {
              company_name: curr.company_name,
              contact_name: curr.contact_name,
              contact_email: curr.contact_email,
              contact_phone: curr.contact_phone,
              source: curr.source,
              estimated_value: curr.estimated_value,
              notes: curr.notes,
              cnpj: curr.cnpj,
              razao_social: curr.razao_social,
              categoria: curr.categoria,
              setor: curr.setor,
              responsavel: curr.responsavel,
              compra_tecido_mensal: curr.compra_tecido_mensal,
              rua: curr.rua,
              bairro: curr.bairro,
              cep: curr.cep,
              expected_close_date: curr.expected_close_date,
              status: curr.status || 'novo',
              scope: 'atendimento',
              source_lead_id: id,
              assigned_to: data.assigned_to,
              created_by: user!.id,
            };
            await supabase.from("leads").insert(dup);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activities"] });
      toast.success("Lead atualizado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });
}


export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido!");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover: " + err.message);
    },
  });
}

export function useAddActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { lead_id: string; activity_type: string; description: string }) => {
      const { error } = await supabase.from("lead_activities").insert({
        ...data,
        user_id: user!.id,
      });
      if (error) throw error;

      // Update last_contact_at
      await supabase
        .from("leads")
        .update({ last_contact_at: new Date().toISOString() })
        .eq("id", data.lead_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Atividade registrada!");
    },
    onError: (err: any) => {
      toast.error("Erro: " + err.message);
    },
  });
}
