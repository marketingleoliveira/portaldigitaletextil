import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, CheckCircle2, XCircle, ArrowRight, Clock } from "lucide-react";
import { useRoomStatus } from "@/hooks/useRoomReservations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function RoomStatusCard() {
  const { data: status, isLoading } = useRoomStatus();

  if (isLoading) {
    return (
      <Card className="hover:shadow-md transition-all cursor-pointer">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-muted animate-pulse w-12 h-12" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
              <div className="h-3 bg-muted animate-pulse rounded w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Link to="/reserva-salas">
      <Card className={cn(
        "hover:shadow-md transition-all cursor-pointer border-2",
        status.occupied
          ? "border-destructive/30 hover:border-destructive/50"
          : "border-emerald-500/30 hover:border-emerald-500/50"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 rounded-lg",
                status.occupied ? "bg-destructive/10" : "bg-emerald-100 dark:bg-emerald-900/20"
              )}>
                <DoorOpen className={cn(
                  "w-6 h-6",
                  status.occupied ? "text-destructive" : "text-emerald-600"
                )} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sala de Reunião</p>
                <div className="flex items-center gap-2 mt-1">
                  {status.occupied ? (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <XCircle className="w-3 h-3" />
                      OCUPADA
                    </Badge>
                  ) : (
                    <Badge className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />
                      DISPONÍVEL
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                  <Clock className="w-3 h-3" />
                  {status.occupied ? (
                    <span>Desocupa às {format(new Date(status.endsAt!), "HH:mm")}</span>
                  ) : status.nextReservation ? (
                    <span>Próx: {format(new Date(status.nextReservation.start_time), "HH:mm 'de' dd/MM", { locale: ptBR })}</span>
                  ) : (
                    <span>Sem reservas</span>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
