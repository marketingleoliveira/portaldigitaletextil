import { type Lead, LEAD_SOURCE_CONFIG } from "@/hooks/useCRM";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User } from "lucide-react";
import { format } from "date-fns";

interface CRMTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

export function CRMTable({ leads, onSelectLead }: CRMTableProps) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectLead(lead)}>
              <TableCell className="font-medium">{lead.company_name}</TableCell>
              <TableCell>{lead.contact_name}</TableCell>
              <TableCell><LeadStatusBadge status={lead.status} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{LEAD_SOURCE_CONFIG[lead.source]}</TableCell>
              <TableCell className="text-right font-medium">
                {lead.estimated_value > 0 ? formatCurrency(lead.estimated_value) : "-"}
              </TableCell>
              <TableCell>
                {lead.assigned_profile ? (
                  <div className="flex items-center gap-1.5">
                    {lead.assigned_profile.avatar_url ? (
                      <img src={lead.assigned_profile.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                    )}
                    <span className="text-sm">{lead.assigned_profile.full_name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(lead.created_at), "dd/MM/yyyy")}
              </TableCell>
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhum lead encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
