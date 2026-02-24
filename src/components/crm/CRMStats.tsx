import { type Lead, LEAD_STATUS_CONFIG, type LeadStatus } from "@/hooks/useCRM";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Trophy, Target } from "lucide-react";

interface CRMStatsProps {
  leads: Lead[];
}

export function CRMStats({ leads }: CRMStatsProps) {
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === "ganho");
  const conversionRate = totalLeads > 0 ? ((wonLeads.length / totalLeads) * 100).toFixed(1) : "0";
  const activeLeads = leads.filter((l) => !["ganho", "perdido"].includes(l.status)).length;

  const stats = [
    { label: "Total de Leads", value: totalLeads, icon: Users, color: "text-blue-600" },
    { label: "Pipeline Ativo", value: activeLeads, icon: Target, color: "text-amber-600" },
    { label: "Troféus Conquistados", value: wonLeads.length, icon: Trophy, color: "text-amber-500" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-violet-600" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
