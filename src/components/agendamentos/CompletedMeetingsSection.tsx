import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Building2, User, Clock, CalendarIcon, ChevronDown, ChevronUp,
  History, Download, FileText, Video, ExternalLink,
} from "lucide-react";
import { format, isSameMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { LeadSchedule } from "@/hooks/useLeadSchedules";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  schedules: LeadSchedule[];
  currentMonth: Date;
}

function useMeetingRecordings(meetingId: string | null) {
  return useQuery({
    queryKey: ["meeting-recordings", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_recordings")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });
}

export default function CompletedMeetingsSection({ schedules, currentMonth }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<LeadSchedule | null>(null);

  const completedAll = schedules.filter((s) => !!s.completed_at);
  const completedThisMonth = completedAll.filter((s) =>
    isSameMonth(new Date(s.completed_at!), currentMonth)
  );
  const completedPrevious = completedAll.filter(
    (s) => !isSameMonth(new Date(s.completed_at!), currentMonth)
  );

  const { data: recordings = [], isLoading: loadingRecordings } = useMeetingRecordings(
    selectedSchedule?.meeting_id ?? null
  );

  if (completedAll.length === 0) return null;

  const renderCard = (schedule: LeadSchedule) => {
    const dateObj = new Date(schedule.scheduled_date);
    const completedDate = new Date(schedule.completed_at!);

    return (
      <button
        key={schedule.id}
        type="button"
        onClick={() => setSelectedSchedule(schedule)}
        className="w-full text-left rounded-lg border bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800 p-3 hover:shadow-sm transition-all"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-medium">{format(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-300">
            Realizado
          </Badge>
        </div>
        <p className="font-semibold text-sm truncate">{schedule.title}</p>
        {schedule.lead && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Building2 className="w-3 h-3" />
            <span>{schedule.lead.company_name}</span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          Concluído em {format(completedDate, "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </button>
    );
  };

  return (
    <>
      {/* Completed this month */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">
              Reuniões concluídas em {format(currentMonth, "MMMM", { locale: ptBR })}
            </h3>
          </div>
          <Badge variant="secondary" className="text-xs">{completedThisMonth.length}</Badge>
        </div>
        <div className="p-3">
          {completedThisMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma reunião concluída neste mês
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {completedThisMonth.map(renderCard)}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {completedPrevious.length > 0 && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-5 py-4 border-b flex items-center justify-between hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Histórico de reuniões</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{completedPrevious.length}</Badge>
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {showHistory && (
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {completedPrevious.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedSchedule} onOpenChange={(o) => !o && setSelectedSchedule(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-600" />
              {selectedSchedule?.title}
            </DialogTitle>
            <DialogDescription>Detalhes da reunião concluída</DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4">
              {/* Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {format(new Date(selectedSchedule.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {selectedSchedule.completed_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Concluído em {format(new Date(selectedSchedule.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>

              {/* Lead Info */}
              {selectedSchedule.lead && (
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {selectedSchedule.lead.company_name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    {selectedSchedule.lead.contact_name}
                  </div>
                  {selectedSchedule.lead.contact_email && (
                    <p className="text-xs text-muted-foreground ml-6">{selectedSchedule.lead.contact_email}</p>
                  )}
                  {selectedSchedule.lead.contact_phone && (
                    <p className="text-xs text-muted-foreground ml-6">{selectedSchedule.lead.contact_phone}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedSchedule.notes && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{selectedSchedule.notes}</p>
                </div>
              )}

              {/* Created by */}
              {selectedSchedule.created_by_profile && (
                <p className="text-xs text-muted-foreground">
                  Agendado por {selectedSchedule.created_by_profile.full_name}
                </p>
              )}

              {/* Recordings */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Gravações</p>
                {loadingRecordings ? (
                  <p className="text-xs text-muted-foreground">Carregando...</p>
                ) : recordings.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <FileText className="w-6 h-6 mx-auto text-muted-foreground/40 mb-1" />
                    <p className="text-xs text-muted-foreground">Nenhuma gravação disponível</p>
                  </div>
                ) : (
                  recordings.map((rec) => (
                    <div key={rec.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{rec.meeting_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(rec.meeting_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {rec.duration_seconds && ` • ${Math.round(rec.duration_seconds / 60)} min`}
                        </p>
                      </div>
                      {rec.download_url && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1"
                            asChild
                          >
                            <a href={rec.download_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                              Ver
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs gap-1"
                            asChild
                          >
                            <a href={rec.download_url} download>
                              <Download className="w-3 h-3" />
                              Baixar
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
