import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type PunchType = 'entry' | 'lunch_exit' | 'lunch_return' | 'exit';

interface TimeRecord {
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
}

const punchSchedule: { type: PunchType; hour: number; label: string; column: keyof TimeRecord }[] = [
  { type: 'entry', hour: 8, label: 'Entrada', column: 'entry_time' },
  { type: 'lunch_exit', hour: 12, label: 'Saída para Almoço', column: 'lunch_exit_time' },
  { type: 'lunch_return', hour: 13, label: 'Retorno do Almoço', column: 'lunch_return_time' },
  { type: 'exit', hour: 18, label: 'Saída', column: 'exit_time' },
];

export function useTimeClockReminder() {
  const { user } = useAuth();
  const lastAlertRef = useRef<string | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndAlert = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const today = format(now, 'yyyy-MM-dd');

    // Only check during work hours (7:55 - 18:15)
    if (currentHour < 7 || (currentHour >= 18 && currentMinute > 15)) return;

    // Fetch today's record
    const { data: record } = await supabase
      .from('time_records')
      .select('entry_time, lunch_exit_time, lunch_return_time, exit_time')
      .eq('user_id', user.id)
      .eq('record_date', today)
      .maybeSingle();

    for (const punch of punchSchedule) {
      const isPunched = record?.[punch.column];
      
      // Alert window: 5 minutes before to 15 minutes after the expected time
      const isInAlertWindow = 
        (currentHour === punch.hour - 1 && currentMinute >= 55) ||
        (currentHour === punch.hour && currentMinute <= 15);

      if (isInAlertWindow && !isPunched) {
        const alertKey = `${today}-${punch.type}`;
        
        // Only show alert once per punch type per day (every 5 minutes max)
        const lastAlertTime = lastAlertRef.current;
        if (lastAlertTime !== alertKey) {
          lastAlertRef.current = alertKey;
          
          toast.warning(`⏰ Hora de bater o ponto!`, {
            description: `Não esqueça de registrar: ${punch.label}`,
            duration: 10000,
            action: {
              label: "Ir para Ponto",
              onClick: () => {
                window.location.href = '/ponto';
              },
            },
          });
        }
        break; // Only show one alert at a time
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Check immediately
    checkAndAlert();

    // Check every minute
    checkIntervalRef.current = setInterval(checkAndAlert, 60000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [user, checkAndAlert]);
}
