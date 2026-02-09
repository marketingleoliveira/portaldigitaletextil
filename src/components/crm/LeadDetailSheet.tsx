import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadStatusBadge } from "./LeadStatusBadge";
import {
  type Lead, type LeadStatus, type LeadSource,
  LEAD_STATUS_CONFIG, LEAD_SOURCE_CONFIG,
  useUpdateLead, useDeleteLead, useLeadActivities, useAddActivity, useVendedores,
} from "@/hooks/useCRM";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, User, Phone, Mail, DollarSign, Calendar, Clock, Trash2, Loader2, MessageSquare, PhoneCall, Video, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTIVITY_TYPES = [
  { value: "note", label: "Nota", icon: FileText },
  { value: "call", label: "Ligação", icon: PhoneCall },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
];

export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
  const { user } = useAuth();
  const isDev = user?.role === "dev";
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const addActivity = useAddActivity();
  const { data: activities, isLoading: loadingActivities } = useLeadActivities(lead?.id || "");
  const { data: vendedores } = useVendedores();

  const [activityType, setActivityType] = useState("note");
  const [activityDesc, setActivityDesc] = useState("");

  if (!lead) return null;

  const handleStatusChange = (status: LeadStatus) => {
    updateLead.mutate({ id: lead.id, status });
  };

  const handleAssign = (userId: string) => {
    updateLead.mutate({ id: lead.id, assigned_to: userId });
  };

  const handleDelete = async () => {
    await deleteLead.mutateAsync(lead.id);
    onOpenChange(false);
  };

  const handleAddActivity = async () => {
    if (!activityDesc.trim()) return;
    await addActivity.mutateAsync({
      lead_id: lead.id,
      activity_type: activityType,
      description: activityDesc.trim(),
    });
    setActivityDesc("");
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg">{lead.company_name}</SheetTitle>
              <LeadStatusBadge status={lead.status} className="mt-1" />
            </div>
            {isDev && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
            <TabsTrigger value="activities" className="flex-1">Atividades</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{lead.contact_name}</span>
              </div>
              {lead.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${lead.contact_email}`} className="text-primary hover:underline">{lead.contact_email}</a>
                </div>
              )}
              {lead.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${lead.contact_phone}`} className="text-primary hover:underline">{lead.contact_phone}</a>
                </div>
              )}
              {lead.estimated_value > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{formatCurrency(lead.estimated_value)}</span>
                </div>
              )}
              {lead.expected_close_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Previsão: {format(new Date(lead.expected_close_date), "dd/MM/yyyy")}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Criado em {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Origem: {LEAD_SOURCE_CONFIG[lead.source]}
              </div>
            </div>

            <Separator />

            {/* Status Change */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Alterar Status</Label>
              <Select value={lead.status} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assign */}
            {isDev && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Vendedor Responsável</Label>
                <Select value={lead.assigned_to || ""} onValueChange={handleAssign}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {vendedores?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="activities" className="mt-4 space-y-4">
            {/* Add Activity */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <div className="flex gap-2">
                {ACTIVITY_TYPES.map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    variant={activityType === t.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActivityType(t.value)}
                    className="text-xs gap-1"
                  >
                    <t.icon className="w-3 h-3" />
                    {t.label}
                  </Button>
                ))}
              </div>
              <Textarea
                value={activityDesc}
                onChange={(e) => setActivityDesc(e.target.value)}
                placeholder="Descreva a atividade..."
                rows={2}
              />
              <Button size="sm" onClick={handleAddActivity} disabled={addActivity.isPending || !activityDesc.trim()}>
                {addActivity.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Registrar
              </Button>
            </div>

            <Separator />

            {/* Activity List */}
            {loadingActivities ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((act) => {
                  const typeConfig = ACTIVITY_TYPES.find((t) => t.value === act.activity_type);
                  const Icon = typeConfig?.icon || MessageSquare;
                  return (
                    <div key={act.id} className="flex gap-3 text-sm">
                      <div className="mt-0.5 p-1.5 bg-muted rounded-md">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{act.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {act.user_profile?.full_name} • {format(new Date(act.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade registrada</p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
