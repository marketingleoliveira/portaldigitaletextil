import { useState, type DragEvent } from "react";
import { type Lead, type LeadStatus, LEAD_STATUS_CONFIG, useUpdateLead } from "@/hooks/useCRM";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { Card } from "@/components/ui/card";
import { User, Phone, DollarSign, Trophy, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface CRMKanbanProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

const KANBAN_COLUMNS: LeadStatus[] = ["novo", "contatado", "qualificado", "proposta", "ganho", "perdido"];

export function CRMKanban({ leads, onSelectLead }: CRMKanbanProps) {
  const updateLead = useUpdateLead();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);

  const getLeadsByStatus = (status: LeadStatus) =>
    leads.filter((l) => l.status === status);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleDragStart = (e: DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  };

  const handleDragLeave = (e: DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDrop = (e: DragEvent, targetStatus: LeadStatus) => {
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
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const columnLeads = getLeadsByStatus(status);
        const config = LEAD_STATUS_CONFIG[status];
        const totalValue = columnLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
        const isOver = dropTarget === status;

        return (
          <div
            key={status}
            className="min-w-[260px] max-w-[280px] flex-shrink-0"
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                {status === "ganho" ? (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-bold text-amber-600">{columnLeads.length}</span>
                  </div>
                ) : (
                  <>
                    <LeadStatusBadge status={status} />
                    <span className="text-xs text-muted-foreground font-medium">
                      {columnLeads.length}
                    </span>
                  </>
                )}
              </div>
              {totalValue > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(totalValue)}
                </span>
              )}
            </div>

            <div
              className={cn(
                "space-y-2 min-h-[200px] rounded-lg p-2 transition-colors duration-150",
                isOver && draggedLeadId
                  ? "bg-primary/10 ring-2 ring-primary/30"
                  : "bg-muted/30"
              )}
            >
              {columnLeads.map((lead) => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border group",
                    draggedLeadId === lead.id && "opacity-40 scale-95"
                  )}
                  onClick={() => onSelectLead(lead)}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{lead.company_name}</p>
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
                      {lead.estimated_value > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-emerald-600">
                          <DollarSign className="w-3 h-3" />
                          <span>{formatCurrency(lead.estimated_value)}</span>
                        </div>
                      )}
                      {lead.assigned_profile && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t">
                          {lead.assigned_profile.avatar_url ? (
                            <img src={lead.assigned_profile.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground truncate">
                            {lead.assigned_profile.full_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
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
  );
}
