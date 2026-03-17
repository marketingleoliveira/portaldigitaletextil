import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Loader2, Video, User } from "lucide-react";
import { type Lead } from "@/hooks/useCRM";
import { useVendedores } from "@/hooks/useCRM";
import { useCreateLeadSchedule } from "@/hooks/useLeadSchedules";

interface ScheduleMeetingDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleMeetingDialog({ lead, open, onOpenChange }: ScheduleMeetingDialogProps) {
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("09:00");
  const [title, setTitle] = useState(`Reunião - ${lead.company_name}`);
  const [notes, setNotes] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState<string>(lead.assigned_to || "");
  const createSchedule = useCreateLeadSchedule();
  const { data: vendedores } = useVendedores();

  const handleSubmit = async () => {
    if (!date) return;

    const [hours, minutes] = time.split(":").map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours, minutes, 0, 0);

    await createSchedule.mutateAsync({
      lead_id: lead.id,
      scheduled_date: scheduledDate.toISOString(),
      title,
      notes: notes || undefined,
      assigned_to: selectedVendedor || undefined,
    });

    onOpenChange(false);
    setDate(undefined);
    setTime("09:00");
    setTitle(`Reunião - ${lead.company_name}`);
    setNotes("");
    setSelectedVendedor("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Agendar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium">{lead.company_name}</p>
            <p className="text-muted-foreground">{lead.contact_name}</p>
          </div>

          <div className="space-y-2">
            <Label>Título da reunião</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Vendedor responsável */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              Vendedor responsável
            </Label>
            <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar vendedor..." />
              </SelectTrigger>
              <SelectContent>
                {vendedores?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.full_name} {v.region ? `(${v.region})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Horário
            </Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione detalhes sobre a reunião..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!date || !title.trim() || createSchedule.isPending}
            >
              {createSchedule.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Agendar Reunião
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
