import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useLeadSchedules, useCompleteLeadSchedule, useDeleteLeadSchedule } from "@/hooks/useLeadSchedules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ChevronLeft, ChevronRight, Video, Building2, User, Clock,
  Copy, CheckCircle2, Circle, Calendar as CalendarIcon, Trash2,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek,
  isPast,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LeadSchedule } from "@/hooks/useLeadSchedules";
import { useAuth } from "@/contexts/AuthContext";

export default function Agendamentos() {
  const { data: schedules = [], isLoading } = useLeadSchedules();
  const completeMutation = useCompleteLeadSchedule();
  const deleteMutation = useDeleteLeadSchedule();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSchedulesForDay = (day: Date) =>
    schedules.filter((s) => isSameDay(new Date(s.scheduled_date), day));

  const selectedSchedules = selectedDate
    ? getSchedulesForDay(selectedDate)
    : [];

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const copyMeetingLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/reuniao/${code}`);
    toast.success("Link copiado!");
  };

  const handleComplete = (schedule: LeadSchedule) => {
    if (!schedule.completed_at) {
      completeMutation.mutate(schedule.id);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Reuniões agendadas com leads prospectados
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Calendar Grid */}
            <div className="border rounded-xl bg-card overflow-hidden">
              {/* Month Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-base font-semibold capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 border-b">
                {dayNames.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const daySchedules = getSchedulesForDay(day);
                  const inMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);
                  const hasCompleted = daySchedules.some((s) => s.completed_at);
                  const hasPending = daySchedules.some((s) => !s.completed_at);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "relative min-h-[72px] p-1.5 border-b border-r text-left transition-colors hover:bg-accent/50",
                        !inMonth && "opacity-30",
                        isSelected && "bg-accent ring-2 ring-primary/30",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-6 h-6 text-xs rounded-full",
                          today && "bg-primary text-primary-foreground font-bold",
                        )}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Dots */}
                      {daySchedules.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap">
                          {daySchedules.slice(0, 3).map((s) => (
                            <div
                              key={s.id}
                              className={cn(
                                "w-full text-[10px] leading-tight truncate rounded px-1 py-0.5",
                                s.completed_at
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {format(new Date(s.scheduled_date), "HH:mm")} {s.lead?.company_name || s.title}
                            </div>
                          ))}
                          {daySchedules.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{daySchedules.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sidebar - Day Detail */}
            <div className="border rounded-xl bg-card overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b">
                <h3 className="font-semibold text-sm">
                  {selectedDate
                    ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : "Selecione um dia"}
                </h3>
                {selectedDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedSchedules.length === 0
                      ? "Nenhum agendamento"
                      : `${selectedSchedules.length} agendamento${selectedSchedules.length > 1 ? "s" : ""}`}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CalendarIcon className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum agendamento neste dia</p>
                  </div>
                ) : (
                  selectedSchedules.map((schedule) => {
                    const dateObj = new Date(schedule.scheduled_date);
                    const isCompleted = !!schedule.completed_at;

                    return (
                      <div
                        key={schedule.id}
                        className={cn(
                          "rounded-lg border p-3 transition-all",
                          isCompleted
                            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                            : "bg-card hover:shadow-sm"
                        )}
                      >
                        {/* Time & Status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{format(dateObj, "HH:mm")}</span>
                            {isToday(dateObj) && !isCompleted && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">HOJE</Badge>
                            )}
                          </div>
                          {isCompleted ? (
                            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Realizado
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-emerald-600"
                              onClick={() => handleComplete(schedule)}
                              disabled={completeMutation.isPending}
                            >
                              <Circle className="w-3 h-3" />
                              Marcar realizado
                            </Button>
                          )}
                        </div>

                        {/* Title */}
                        <p className={cn(
                          "font-semibold text-sm",
                          isCompleted && "line-through opacity-70"
                        )}>
                          {schedule.title}
                        </p>

                        {/* Lead Info */}
                        {schedule.lead && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{schedule.lead.company_name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{schedule.lead.contact_name}</span>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {schedule.meeting && !isCompleted && (
                          <div className="flex gap-2 mt-3 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => navigate(`/reuniao/${schedule.meeting!.meeting_code}`)}
                              className="text-xs gap-1 h-7 flex-1"
                            >
                              <Video className="w-3 h-3" />
                              Entrar na Reunião
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyMeetingLink(schedule.meeting!.meeting_code)}
                              className="text-xs gap-1 h-7"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        )}

                        {/* Creator & Delete */}
                        <div className="flex items-center justify-between mt-2">
                          {schedule.created_by_profile && (
                            <p className="text-[10px] text-muted-foreground">
                              Agendado por {schedule.created_by_profile.full_name}
                            </p>
                          )}
                          {isCompleted && user?.role === 'dev' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(schedule.id)}
                              disabled={deleteMutation.isPending}
                              title="Excluir agendamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
