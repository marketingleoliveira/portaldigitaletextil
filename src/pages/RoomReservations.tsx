import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  useRoomReservations, useRoomStatus, useCreateReservation, useDeleteReservation,
} from "@/hooks/useRoomReservations";
import { format, isSameDay, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DoorOpen, Plus, Clock, User, Trash2, CalendarIcon, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h to 19h

export default function RoomReservations() {
  const { user } = useAuth();
  const isDev = user?.role === "dev";
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStartHour, setFormStartHour] = useState("08");
  const [formStartMin, setFormStartMin] = useState("00");
  const [formEndHour, setFormEndHour] = useState("09");
  const [formEndMin, setFormEndMin] = useState("00");

  const { data: reservations = [], isLoading } = useRoomReservations(selectedDate);
  const { data: roomStatus } = useRoomStatus();
  const createMutation = useCreateReservation();
  const deleteMutation = useDeleteReservation();

  const handleCreate = () => {
    if (!formTitle.trim()) return;
    const start = new Date(selectedDate);
    start.setHours(Number(formStartHour), Number(formStartMin), 0, 0);
    const end = new Date(selectedDate);
    end.setHours(Number(formEndHour), Number(formEndMin), 0, 0);

    if (end <= start) {
      return;
    }

    createMutation.mutate(
      {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setFormTitle("");
          setFormDesc("");
          setFormStartHour("08");
          setFormStartMin("00");
          setFormEndHour("09");
          setFormEndMin("00");
        },
      }
    );
  };

  const canDelete = (reservation: any) =>
    reservation.user_id === user?.id || isDev;

  // Build a visual timeline
  const getReservationPosition = (r: any) => {
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const dayStart = 7 * 60;
    const dayEnd = 19 * 60;
    const top = ((startMinutes - dayStart) / (dayEnd - dayStart)) * 100;
    const height = ((endMinutes - startMinutes) / (dayEnd - dayStart)) * 100;
    return { top: `${Math.max(0, top)}%`, height: `${Math.min(100 - top, height)}%` };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DoorOpen className="w-5 h-5 text-primary" />
              </div>
              Reserva de Salas
            </h1>
            <p className="text-muted-foreground mt-1">
              Agende a sala de reunião física da empresa
            </p>
          </div>

          {/* Room Status */}
          {roomStatus && (
            <Card className={cn(
              "border-2 min-w-[280px]",
              roomStatus.occupied
                ? "border-destructive/50 bg-destructive/5"
                : "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10"
            )}>
              <CardContent className="p-4 flex items-center gap-3">
                {roomStatus.occupied ? (
                  <>
                    <XCircle className="w-8 h-8 text-destructive shrink-0" />
                    <div>
                      <p className="font-bold text-destructive text-sm">SALA OCUPADA</p>
                      <p className="text-xs text-muted-foreground">
                        Desocupa às {format(new Date(roomStatus.endsAt!), "HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(roomStatus.currentReservation as any)?.profile?.full_name}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-600 text-sm">SALA DISPONÍVEL</p>
                      {roomStatus.nextReservation ? (
                        <p className="text-xs text-muted-foreground">
                          Próxima reserva: {format(new Date(roomStatus.nextReservation.start_time), "HH:mm 'de' dd/MM", { locale: ptBR })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem reservas futuras</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left: Calendar + New Button */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </CardContent>
            </Card>

            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full gap-2"
              size="lg"
              disabled={isBefore(selectedDate, new Date()) && !isToday(selectedDate)}
            >
              <Plus className="w-5 h-5" />
              Reservar Sala
            </Button>
          </div>

          {/* Right: Schedule View */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                {isToday(selectedDate) && (
                  <Badge variant="secondary">Hoje</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="relative">
                  {/* Time grid */}
                  <div className="space-y-0">
                    {HOURS.map((hour) => {
                      const hourReservations = reservations.filter((r) => {
                        const start = new Date(r.start_time);
                        const end = new Date(r.end_time);
                        return start.getHours() <= hour && end.getHours() > hour;
                      });

                      return (
                        <div key={hour} className="flex border-t border-border min-h-[60px]">
                          <div className="w-16 shrink-0 pr-3 py-2 text-right text-xs text-muted-foreground font-mono">
                            {String(hour).padStart(2, "0")}:00
                          </div>
                          <div className="flex-1 py-1 px-2 space-y-1">
                            {reservations
                              .filter((r) => {
                                const startH = new Date(r.start_time).getHours();
                                return startH === hour;
                              })
                              .map((r) => {
                                const start = new Date(r.start_time);
                                const end = new Date(r.end_time);
                                const durationMin = (end.getTime() - start.getTime()) / 60000;
                                const spans = Math.max(1, Math.ceil(durationMin / 60));

                                return (
                                  <div
                                    key={r.id}
                                    className={cn(
                                      "rounded-lg border p-3 transition-all",
                                      r.user_id === user?.id
                                        ? "bg-primary/10 border-primary/30"
                                        : "bg-muted/50 border-border"
                                    )}
                                    style={{ minHeight: `${spans * 48}px` }}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-sm truncate">{r.title}</p>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                          <Clock className="w-3 h-3" />
                                          <span>
                                            {format(start, "HH:mm")} - {format(end, "HH:mm")}
                                          </span>
                                          <span className="text-muted-foreground/50">
                                            ({Math.round(durationMin)} min)
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                          <User className="w-3 h-3" />
                                          <span>{r.profile?.full_name || "Usuário"}</span>
                                        </div>
                                        {r.description && (
                                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {r.description}
                                          </p>
                                        )}
                                      </div>
                                      {canDelete(r) && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                          onClick={() => deleteMutation.mutate(r.id)}
                                          disabled={deleteMutation.isPending}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty state */}
                  {reservations.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <DoorOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-2" />
                        <p className="text-muted-foreground text-sm">
                          Nenhuma reserva neste dia
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-primary" />
              Reservar Sala
            </DialogTitle>
            <DialogDescription>
              {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Reunião com cliente"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <div className="flex gap-1">
                  <Select value={formStartHour} onValueChange={setFormStartHour}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h).padStart(2, "0")}>
                          {String(h).padStart(2, "0")}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formStartMin} onValueChange={setFormStartMin}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["00", "15", "30", "45"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fim</Label>
                <div className="flex gap-1">
                  <Select value={formEndHour} onValueChange={setFormEndHour}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h).padStart(2, "0")}>
                          {String(h).padStart(2, "0")}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formEndMin} onValueChange={setFormEndMin}>
                    <SelectTrigger className="w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["00", "15", "30", "45"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={!formTitle.trim() || createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Reservando..." : "Confirmar Reserva"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
