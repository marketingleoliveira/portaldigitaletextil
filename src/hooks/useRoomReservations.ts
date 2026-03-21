import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RoomReservation {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  profile?: { full_name: string; avatar_url: string | null } | null;
}

export function useRoomReservations(date?: Date) {
  return useQuery({
    queryKey: ["room-reservations", date?.toISOString()?.slice(0, 10)],
    queryFn: async () => {
      let query = (supabase as any)
        .from("room_reservations")
        .select("*, profile:profiles!room_reservations_user_id_fkey(full_name, avatar_url)")
        .order("start_time", { ascending: true });

      if (date) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        query = query
          .gte("start_time", dayStart.toISOString())
          .lte("start_time", dayEnd.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as RoomReservation[];
    },
  });
}

export function useRoomStatus() {
  return useQuery({
    queryKey: ["room-status"],
    queryFn: async () => {
      const now = new Date().toISOString();

      // Check if room is currently occupied
      const { data: current } = await supabase
        .from("room_reservations")
        .select("*, profile:profiles!room_reservations_user_id_fkey(full_name)")
        .lte("start_time", now)
        .gte("end_time", now)
        .limit(1)
        .maybeSingle();

      if (current) {
        return {
          occupied: true,
          currentReservation: current as unknown as RoomReservation,
          endsAt: current.end_time,
          nextReservation: null,
        };
      }

      // Get next reservation
      const { data: next } = await supabase
        .from("room_reservations")
        .select("*, profile:profiles!room_reservations_user_id_fkey(full_name)")
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        occupied: false,
        currentReservation: null,
        endsAt: null,
        nextReservation: next as unknown as RoomReservation | null,
      };
    },
    refetchInterval: 60000, // refresh every minute
  });
}

interface CreateReservationData {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateReservationData) => {
      // Check for conflicts
      const { data: conflicts } = await supabase
        .from("room_reservations")
        .select("id")
        .or(`and(start_time.lt.${data.end_time},end_time.gt.${data.start_time})`);

      if (conflicts && conflicts.length > 0) {
        throw new Error("Já existe uma reserva neste horário. Escolha outro horário.");
      }

      const { error } = await supabase
        .from("room_reservations")
        .insert({
          user_id: user!.id,
          title: data.title,
          description: data.description || null,
          start_time: data.start_time,
          end_time: data.end_time,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["room-status"] });
      toast.success("Sala reservada com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao reservar sala");
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("room_reservations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["room-status"] });
      toast.success("Reserva cancelada!");
    },
    onError: (err: any) => {
      toast.error("Erro ao cancelar: " + err.message);
    },
  });
}
