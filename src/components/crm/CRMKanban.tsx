import { type Lead, type LeadStatus, LEAD_STATUS_CONFIG, useUpdateLead } from "@/hooks/useCRM";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { Card } from "@/components/ui/card";
import { User, Phone, Mail, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface CRMKanbanProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

const KANBAN_COLUMNS: LeadStatus[] = ["novo", "contatado", "qualificado", "proposta", "negociacao", "ganho", "perdido"];

export function CRMKanban({ leads, onSelectLead }: CRMKanbanProps) {
  const updateLead = useUpdateLead();

  const getLeadsByStatus = (status: LeadStatus) =>
    leads.filter((l) => l.status === status);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const columnLeads = getLeadsByStatus(status);
        const config = LEAD_STATUS_CONFIG[status];
        const totalValue = columnLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

        return (
          <div key={status} className="min-w-[260px] max-w-[280px] flex-shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <LeadStatusBadge status={status} />
                <span className="text-xs text-muted-foreground font-medium">
                  {columnLeads.length}
                </span>
              </div>
              {totalValue > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(totalValue)}
                </span>
              )}
            </div>

            <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
              {columnLeads.map((lead) => (
                <Card
                  key={lead.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow border"
                  onClick={() => onSelectLead(lead)}
                >
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
                </Card>
              ))}
              {columnLeads.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
