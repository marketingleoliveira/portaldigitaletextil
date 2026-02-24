import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useLeadSchedules } from "@/hooks/useLeadSchedules";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Video, Building2, User, Clock, Copy } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Agendamentos() {
  const { data: schedules = [], isLoading } = useLeadSchedules();
  const navigate = useNavigate();

  const upcoming = schedules.filter((s) => !isPast(new Date(s.scheduled_date)) || isToday(new Date(s.scheduled_date)));
  const past = schedules.filter((s) => isPast(new Date(s.scheduled_date)) && !isToday(new Date(s.scheduled_date)));

  const copyMeetingLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/reuniao/${code}`);
    toast.success("Link copiado!");
  };

  const renderScheduleCard = (schedule: typeof schedules[0]) => {
    const dateObj = new Date(schedule.scheduled_date);
    const isUpcoming = !isPast(dateObj) || isToday(dateObj);

    return (
      <Card key={schedule.id} className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Video className="w-4 h-4 text-primary shrink-0" />
              <h3 className="font-semibold text-sm truncate">{schedule.title}</h3>
              {isToday(dateObj) && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">HOJE</Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3" />
              <span>{format(dateObj, "dd/MM/yyyy", { locale: ptBR })}</span>
              <Clock className="w-3 h-3 ml-1" />
              <span>{format(dateObj, "HH:mm")}</span>
            </div>

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

            {schedule.created_by_profile && (
              <p className="text-xs text-muted-foreground mt-2">
                Agendado por {schedule.created_by_profile.full_name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            {schedule.meeting && (
              <>
                <Button
                  size="sm"
                  variant={isUpcoming ? "default" : "outline"}
                  onClick={() => navigate(`/reuniao/${schedule.meeting!.meeting_code}`)}
                  className="text-xs gap-1"
                >
                  <Video className="w-3 h-3" />
                  Entrar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyMeetingLink(schedule.meeting!.meeting_code)}
                  className="text-xs gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Link
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
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
        ) : schedules.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium">Nenhum agendamento</p>
            <p className="text-sm text-muted-foreground mt-1">
              Agende reuniões a partir dos leads prospectados no CRM
            </p>
          </Card>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                  Próximas ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map(renderScheduleCard)}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                  Anteriores ({past.length})
                </h2>
                <div className="space-y-3 opacity-70">
                  {past.map(renderScheduleCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
