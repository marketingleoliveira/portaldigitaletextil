import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useTrophyLeads, useReminderLeads } from "@/hooks/useAgendamentosEAD";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, Trophy, Bell, Building2, User, Phone, Mail,
  Calendar, ChevronRight, Search, MapPin, AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AgendamentosProps {
  scope?: 'atendimento' | 'crm';
  title?: string;
  subtitle?: string;
  redirectTo?: string;
}

export default function AgendamentosEAD({
  scope = 'atendimento',
  title = 'Agendamentos EAD',
  subtitle = 'Leads marcados como Troféu e com Lembretes de Retorno',
  redirectTo = '/crm',
}: AgendamentosProps = {}) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: trophyLeads = [], isLoading: loadingTrophy } = useTrophyLeads(scope);
  const { data: reminderLeads = [], isLoading: loadingReminders } = useReminderLeads(scope);


  const filteredTrophy = trophyLeads.filter((lead) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      lead.company_name.toLowerCase().includes(q) ||
      lead.contact_name.toLowerCase().includes(q)
    );
  });

  const filteredReminders = reminderLeads.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.lead.company_name.toLowerCase().includes(q) ||
      item.lead.contact_name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const isLoading = loadingTrophy || loadingReminders;

  const handleLeadClick = (leadId: string) => {
    navigate("/crm");
    // Use a small timeout to let the CRM page load, then open the lead
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-lead-detail", { detail: leadId }));
    }, 300);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agendamentos EAD</h1>
            <p className="text-sm text-muted-foreground">
              Leads marcados como Troféu e com Lembretes de Retorno
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TROFÉU Section */}
            <Card className="border-amber-200/60 dark:border-amber-800/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Troféus Conquistados
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {filteredTrophy.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredTrophy.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Trophy className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum lead marcado como Troféu</p>
                  </div>
                ) : (
                  filteredTrophy.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleLeadClick(lead.id)}
                      className="w-full text-left rounded-lg border p-3 bg-card hover:bg-accent/40 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate">
                              {lead.company_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">
                              {lead.contact_name}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                            {lead.contact_phone && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                {lead.contact_phone}
                              </span>
                            )}
                            {lead.contact_email && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                {lead.contact_email}
                              </span>
                            )}
                          </div>
                          {lead.assigned_profile && (
                            <div className="mt-1.5 text-[11px] text-muted-foreground">
                              Vendedor: {lead.assigned_profile.full_name}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            {/* LEMBRETE DE RETORNO Section */}
            <Card className="border-red-200/60 dark:border-red-800/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-5 h-5 text-red-500" />
                  Lembretes de Retorno
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {filteredReminders.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredReminders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Bell className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum lembrete de retorno pendente</p>
                  </div>
                ) : (
                  filteredReminders.map((item) => {
                    const reminderDate = new Date(item.reminder_date);
                    const isOverdue = isPast(reminderDate) && !isToday(reminderDate);
                    const isDueToday = isToday(reminderDate);

                    return (
                      <button
                        key={item.reminder_id}
                        onClick={() => handleLeadClick(item.lead.id)}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 bg-card hover:bg-accent/40 transition-colors group",
                          isOverdue && "border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">
                                {item.lead.company_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">
                                {item.lead.contact_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className={cn(
                                "text-xs font-medium",
                                isOverdue && "text-red-600 dark:text-red-400",
                                isDueToday && "text-amber-600 dark:text-amber-400"
                              )}>
                                {format(reminderDate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                              {isOverdue && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                  Atrasado
                                </Badge>
                              )}
                              {isDueToday && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700">
                                  Hoje
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <AlertCircle className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="text-[11px] text-muted-foreground line-clamp-2">
                                  {item.description}
                                </span>
                              </div>
                            )}
                            {item.lead.contact_phone && (
                              <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {item.lead.contact_phone}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
