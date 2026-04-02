import { useState, type DragEvent } from "react";
import { type MarketingLead, type MarketingLeadStatus, MARKETING_STATUS_CONFIG, useUpdateMarketingLead } from "@/hooks/useMarketingLeads";
import { useAllMarketingContacts } from "@/hooks/useMarketingContacts";
import { MarketingLeadContactSheet } from "./MarketingLeadContactSheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, GripVertical, Trophy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";

interface MarketingKanbanProps {
  leads: MarketingLead[];
}

const COLUMNS: MarketingLeadStatus[] = ["lead", "contato_inicial", "resposta", "agendado", "depoimento_realizado"];

export function MarketingKanban({ leads }: MarketingKanbanProps) {
  const updateLead = useUpdateMarketingLead();
  const { data: allContacts = [] } = useAllMarketingContacts();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<MarketingLeadStatus | null>(null);
  const [selectedLead, setSelectedLead] = useState<MarketingLead | null>(null);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);

  const getContactCounts = (leadId: string) => {
    const leadContacts = allContacts.filter((c) => c.lead_id === leadId);
    return {
      calls: leadContacts.filter((c) => c.contact_type === "ligacao").length,
      whatsapps: leadContacts.filter((c) => c.contact_type === "whatsapp").length,
    };
  };

  const getLeadsByStatus = (status: MarketingLeadStatus) => leads.filter((l) => l.status === status);

  // Trophy count: leads marked as depoimento_realizado this week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const trophiesThisWeek = leads.filter(
    (l) => l.status === "depoimento_realizado" && isWithinInterval(parseISO(l.updated_at), { start: weekStart, end: weekEnd })
  ).length;
  const weeklyGoal = 5;

  const handleDragStart = (e: DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleDragEnd = () => { setDraggedLeadId(null); setDropTarget(null); };

  const handleDragOver = (e: DragEvent, status: MarketingLeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  };

  const handleDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) setDropTarget(null);
  };

  const handleDrop = (e: DragEvent, targetStatus: MarketingLeadStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== targetStatus) {
      updateLead.mutate({ id: leadId, status: targetStatus });
    }
    setDraggedLeadId(null);
    setDropTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Weekly trophy progress */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">Meta Semanal de Depoimentos</p>
              <p className="text-xs text-muted-foreground">{trophiesThisWeek} de {weeklyGoal} depoimentos realizados esta semana</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: weeklyGoal }).map((_, i) => (
              <Trophy
                key={i}
                className={cn(
                  "w-5 h-5 transition-colors",
                  i < trophiesThisWeek ? "text-amber-500" : "text-muted-foreground/20"
                )}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const columnLeads = getLeadsByStatus(status);
          const config = MARKETING_STATUS_CONFIG[status];
          const isOver = dropTarget === status;
          const isRealizado = status === "depoimento_realizado";

          return (
            <div
              key={status}
              className="min-w-[240px] max-w-[260px] flex-shrink-0"
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  {isRealizado ? (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-bold text-amber-600">{columnLeads.length}</span>
                    </div>
                  ) : (
                    <>
                      <Badge variant="outline" className={cn("text-[10px]", config.color)}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">{columnLeads.length}</span>
                    </>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "space-y-2 min-h-[200px] rounded-lg p-2 transition-colors duration-150",
                  isOver && draggedLeadId ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/30"
                )}
              >
                {columnLeads.map((lead) => {
                  const counts = getContactCounts(lead.id);
                  return (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { setSelectedLead(lead); setContactSheetOpen(true); }}
                      className={cn(
                        "p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border group",
                        draggedLeadId === lead.id && "opacity-40 scale-95"
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold text-sm truncate">{lead.company_name}</p>
                            {status === "agendado" && (
                              <button
                                type="button"
                                title="Marcar como Depoimento Realizado"
                                className="p-1 rounded-md hover:bg-amber-100 text-amber-500 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateLead.mutate({ id: lead.id, status: "depoimento_realizado" });
                                }}
                              >
                                <Trophy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span className="truncate">{lead.contact_name}</span>
                          </div>
                          {lead.contact_phone && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{lead.contact_phone}</span>
                            </div>
                          )}
                          {(counts.calls > 0 || counts.whatsapps > 0) && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                              {counts.calls > 0 && (
                                <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
                                  <Phone className="w-2.5 h-2.5" />
                                  {counts.calls}
                                </Badge>
                              )}
                              {counts.whatsapps > 0 && (
                                <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5">
                                  <MessageCircle className="w-2.5 h-2.5" />
                                  {counts.whatsapps}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {columnLeads.length === 0 && (
                  <p className={cn(
                    "text-xs text-center py-8 transition-colors",
                    isOver && draggedLeadId ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {isOver && draggedLeadId ? "Soltar aqui" : "Nenhum lead"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
