import React, { useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTestimonials } from '@/hooks/useTestimonials';
import { useMarketingLeads } from '@/hooks/useMarketingLeads';
import { MarketingKanban } from '@/components/marketing/MarketingKanban';
import { MarketingImportDialog } from '@/components/marketing/MarketingImportDialog';
import { MarketingLeadFormDialog } from '@/components/marketing/MarketingLeadFormDialog';
import { MarketingActivityStats } from '@/components/marketing/MarketingActivityStats';
import { MarketingReport } from '@/components/marketing/MarketingReport';
import { format, parseISO, isToday, isFuture, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, CalendarCheck, Clock, CheckCircle2, TrendingUp, FileVideo, AlertCircle, Upload, Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AdSlot from '@/components/AdSlot';

const Marketing: React.FC = () => {
  const { testimonials, isLoading } = useTestimonials();
  const { data: marketingLeads = [], isLoading: leadsLoading } = useMarketingLeads();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [activeTab, setActiveTab] = useState('kanban');

  const stats = {
    total: testimonials.length,
    pendentes: testimonials.filter((t) => t.status === 'pendente').length,
    confirmados: testimonials.filter((t) => t.status === 'confirmado').length,
    realizados: testimonials.filter((t) => t.status === 'realizado').length,
    cancelados: testimonials.filter((t) => t.status === 'cancelado').length,
    today: testimonials.filter((t) => isToday(parseISO(t.scheduled_date)) && t.status !== 'realizado' && t.status !== 'cancelado').length,
  };

  const thisWeek = testimonials.filter((t) => {
    const date = parseISO(t.scheduled_date);
    const now = new Date();
    return isWithinInterval(date, { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) });
  });

  const upcoming = testimonials
    .filter((t) => isFuture(parseISO(t.scheduled_date)) && t.status !== 'realizado' && t.status !== 'cancelado')
    .slice(0, 5);

  const completionRate = stats.total > 0 ? Math.round((stats.realizados / stats.total) * 100) : 0;

  const kpiCards = [
    { title: 'Total Agendados', value: stats.total, icon: CalendarCheck, color: 'text-primary' },
    { title: 'Pendentes', value: stats.pendentes, icon: Clock, color: 'text-warning' },
    { title: 'Realizados', value: stats.realizados, icon: CheckCircle2, color: 'text-success' },
    { title: 'Hoje', value: stats.today, icon: AlertCircle, color: stats.today > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Marketing</h1>
            <p className="text-muted-foreground">Visão geral das atividades de marketing</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowNewLead(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Importar
            </Button>
            <Button onClick={() => navigate('/depoimentos')}>
              <FileVideo className="w-4 h-4 mr-2" />
              Gerenciar Depoimentos
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="kanban">Pipeline de Leads</TabsTrigger>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="report">Relatório</TabsTrigger>
          </TabsList>

          <AdSlot />


          <TabsContent value="kanban" className="mt-4">
            {leadsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MarketingKanban leads={marketingLeads} />
            )}
          </TabsContent>

          <TabsContent value="overview" className="mt-4 space-y-6">
            {/* Activity Stats & Recent Logs */}
            <MarketingActivityStats />
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((kpi) => (
                <Card key={kpi.title}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{kpi.title}</p>
                        <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                      </div>
                      <kpi.icon className={`w-8 h-8 ${kpi.color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Taxa de Conclusão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold">{completionRate}%</span>
                      <span className="text-sm text-muted-foreground mb-1">depoimentos realizados</span>
                    </div>
                    <Progress value={completionRate} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stats.realizados} realizados</span>
                      <span>{stats.total} total</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Esta Semana ({thisWeek.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {thisWeek.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum depoimento esta semana</p>
                  ) : (
                    <div className="space-y-2">
                      {thisWeek.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{t.company_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(t.scheduled_date), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <Badge variant={t.status === 'realizado' ? 'secondary' : t.status === 'cancelado' ? 'destructive' : 'outline'} className="text-[10px]">
                            {t.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {upcoming.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próximos Depoimentos</CardTitle>
                  <CardDescription>Agendamentos futuros pendentes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcoming.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate('/depoimentos')}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileVideo className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{t.company_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(t.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {t.orientation_file_name && <Badge variant="outline" className="text-[10px]">Arquivo anexo</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="report" className="mt-4">
            <MarketingReport />
          </TabsContent>
        </Tabs>
      </div>

      <MarketingImportDialog open={showImport} onOpenChange={setShowImport} />
      <MarketingLeadFormDialog open={showNewLead} onOpenChange={setShowNewLead} />
    </DashboardLayout>
  );
};

export default Marketing;
