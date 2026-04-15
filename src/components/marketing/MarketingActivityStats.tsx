import { useAllMarketingContacts } from "@/hooks/useMarketingContacts";
import { useMarketingLeads } from "@/hooks/useMarketingLeads";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, TrendingUp, Activity, Clock } from "lucide-react";
import { format, parseISO, isToday, subDays, isAfter, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function MarketingActivityStats() {
  const { data: contacts = [] } = useAllMarketingContacts();
  const { data: leads = [] } = useMarketingLeads();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

  const todayContacts = contacts.filter((c) => isToday(parseISO(c.created_at)));
  const weekContacts = contacts.filter((c) => {
    const d = parseISO(c.created_at);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });
  const last7Days = contacts.filter((c) => isAfter(parseISO(c.created_at), subDays(now, 7)));

  const totalCalls = contacts.filter((c) => c.contact_type === "ligacao").length;
  const totalWhatsapps = contacts.filter((c) => c.contact_type === "whatsapp").length;
  const todayCalls = todayContacts.filter((c) => c.contact_type === "ligacao").length;
  const todayWhatsapps = todayContacts.filter((c) => c.contact_type === "whatsapp").length;
  const weekCalls = weekContacts.filter((c) => c.contact_type === "ligacao").length;
  const weekWhatsapps = weekContacts.filter((c) => c.contact_type === "whatsapp").length;

  // Leads with at least one contact
  const leadsContacted = new Set(contacts.map((c) => c.lead_id)).size;
  const contactRate = leads.length > 0 ? Math.round((leadsContacted / leads.length) * 100) : 0;

  // Average contacts per lead
  const avgPerLead = leadsContacted > 0 ? (contacts.length / leadsContacted).toFixed(1) : "0";

  const recentContacts = contacts.slice(0, 8);

  const leadMap = new Map(leads.map((l) => [l.id, l]));

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ligações Hoje</p>
                <p className="text-3xl font-bold mt-1">{todayCalls}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: {totalCalls}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                <Phone className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp Hoje</p>
                <p className="text-3xl font-bold mt-1">{todayWhatsapps}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: {totalWhatsapps}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-100 text-green-600">
                <MessageCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Contato</p>
                <p className="text-3xl font-bold mt-1">{contactRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">{leadsContacted} de {leads.length} leads</p>
              </div>
              <div className="p-2.5 rounded-lg bg-violet-100 text-violet-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média por Lead</p>
                <p className="text-3xl font-bold mt-1">{avgPerLead}</p>
                <p className="text-xs text-muted-foreground mt-1">contatos/lead</p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-600">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Resumo da Semana
            </CardTitle>
            <CardDescription>Atividades de contato nesta semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Ligações</span>
                </div>
                <Badge variant="secondary" className="text-sm">{weekCalls}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Mensagens WhatsApp</span>
                </div>
                <Badge variant="secondary" className="text-sm">{weekWhatsapps}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-medium">Total de Contatos</span>
                </div>
                <Badge variant="secondary" className="text-sm">{weekContacts.length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Últimos Registros
            </CardTitle>
            <CardDescription>Atividades recentes nos leads</CardDescription>
          </CardHeader>
          <CardContent>
            {recentContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de contato ainda</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {recentContacts.map((c) => {
                  const lead = leadMap.get(c.lead_id);
                  const isCall = c.contact_type === "ligacao";
                  return (
                    <div key={c.id} className="flex items-start gap-2.5 p-2.5 border rounded-lg bg-background hover:bg-accent/30 transition-colors">
                      <div className={cn("mt-0.5 p-1.5 rounded-md shrink-0", isCall ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600")}>
                        {isCall ? <Phone className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{lead?.company_name ?? "Lead removido"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isCall ? c.result : c.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {isCall ? "Ligação" : "WhatsApp"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
