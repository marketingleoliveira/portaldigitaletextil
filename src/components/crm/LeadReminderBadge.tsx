import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LeadReminder } from "@/hooks/useLeadReminders";

interface LeadReminderBadgeProps {
  reminders: LeadReminder[];
}

export function LeadReminderBadge({ reminders }: LeadReminderBadgeProps) {
  const pending = reminders.filter(r => !r.completed_at);
  const overdue = pending.filter(r => new Date(r.reminder_date) <= new Date());

  if (pending.length === 0) return null;

  const isOverdue = overdue.length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute -top-2 -right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold z-10 shadow-sm",
              isOverdue
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-amber-500 text-white"
            )}
          >
            <Bell className="w-3 h-3" />
            {pending.length}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p className="font-semibold text-xs mb-1">
            {isOverdue ? "⚠️ Retorno pendente!" : "Lembretes agendados"}
          </p>
          {pending.slice(0, 3).map(r => (
            <p key={r.id} className="text-xs">
              {format(new Date(r.reminder_date), "dd/MM HH:mm", { locale: ptBR })} - {r.description}
            </p>
          ))}
          {pending.length > 3 && (
            <p className="text-xs text-muted-foreground">+{pending.length - 3} mais</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
