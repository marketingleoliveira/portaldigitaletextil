import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface LeadServiceSession {
  id: string;
  lead_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
  start_address: string | null;
  start_accuracy: number | null;
  end_latitude: number | null;
  end_longitude: number | null;
  end_address: string | null;
  end_accuracy: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: { full_name: string } | null;
}

async function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada pelo navegador"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

export function useLeadServiceSessions(leadId: string) {
  return useQuery({
    queryKey: ["lead-service-sessions", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_service_sessions")
        .select("*")
        .eq("lead_id", leadId)
        .order("started_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((s) => s.user_id)));
      let profileMap = new Map<string, { full_name: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = new Map((profiles || []).map((p) => [p.id, { full_name: p.full_name }]));
      }

      return (data || []).map((s) => ({
        ...s,
        user_profile: profileMap.get(s.user_id) || null,
      })) as LeadServiceSession[];
    },
    enabled: !!leadId,
  });
}

export function useOpenServiceSession(leadId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lead-service-session-open", leadId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("lead_service_sessions")
        .select("*")
        .eq("lead_id", leadId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LeadServiceSession | null;
    },
    enabled: !!leadId && !!user,
  });
}

export function useStartServiceSession() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (leadId: string) => {
      if (!user) throw new Error("Não autenticado");
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = await reverseGeocode(lat, lng);

      const { data, error } = await supabase
        .from("lead_service_sessions")
        .insert({
          lead_id: leadId,
          user_id: user.id,
          start_latitude: lat,
          start_longitude: lng,
          start_accuracy: pos.coords.accuracy,
          start_address: address,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, leadId) => {
      queryClient.invalidateQueries({ queryKey: ["lead-service-sessions", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-service-session-open", leadId] });
      toast.success("Atendimento iniciado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao iniciar atendimento: " + (err.message || "Verifique permissão de localização"));
    },
  });
}

export function useEndServiceSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, leadId }: { sessionId: string; leadId: string }) => {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = await reverseGeocode(lat, lng);

      const { error } = await supabase
        .from("lead_service_sessions")
        .update({
          ended_at: new Date().toISOString(),
          end_latitude: lat,
          end_longitude: lng,
          end_accuracy: pos.coords.accuracy,
          end_address: address,
        })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: (_d, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["lead-service-sessions", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-service-session-open", leadId] });
      toast.success("Atendimento encerrado!");
    },
    onError: (err: any) => {
      toast.error("Erro ao encerrar atendimento: " + (err.message || "Verifique permissão de localização"));
    },
  });
}
