import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Wallet, Search, Loader2, ExternalLink, CheckCircle2, XCircle, Clock, BadgeDollarSign, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type ExpenseStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'pago';

interface Report {
  id: string;
  user_id: string;
  title: string;
  trip_destination: string | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
  company_advance: number;
  status: ExpenseStatus;
  notes: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string | null;
  total_spent?: number;
}

interface Item {
  id: string;
  report_id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string | null;
  receipt_url: string | null;
  receipt_path: string | null;
}

const STATUS_META: Record<ExpenseStatus, { label: string; className: string; icon: React.ElementType }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400', icon: Clock },
  aprovado: { label: 'Aprovado', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', className: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400', icon: XCircle },
  pago: { label: 'Pago', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400', icon: BadgeDollarSign },
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const FinanceiroReembolsos: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ExpenseStatus>('todos');
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: reps, error } = await supabase
      .from('expense_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar reembolsos: ' + error.message);
      setLoading(false);
      return;
    }
    const list = (reps || []) as Report[];

    const userIds = Array.from(new Set(list.map(r => r.user_id)));
    let profileMap = new Map<string, { full_name: string; email: string; avatar_url: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);
      profileMap = new Map((profs || []).map(p => [p.id, p as any]));
    }

    const reportIds = list.map(r => r.id);
    const grouped: Record<string, Item[]> = {};
    const totals: Record<string, number> = {};
    if (reportIds.length) {
      const { data: its } = await supabase
        .from('expense_items')
        .select('*')
        .in('report_id', reportIds);
      (its || []).forEach(it => {
        (grouped[it.report_id] ||= []).push(it as Item);
        totals[it.report_id] = (totals[it.report_id] || 0) + Number(it.amount || 0);
      });
    }

    setReports(list.map(r => ({
      ...r,
      user_name: profileMap.get(r.user_id)?.full_name || 'Usuário',
      user_email: profileMap.get(r.user_id)?.email || '',
      user_avatar: profileMap.get(r.user_id)?.avatar_url || null,
      total_spent: totals[r.id] || 0,
    })));
    setItems(grouped);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('financeiro_reembolsos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_reports' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: ExpenseStatus) => {
    const { error } = await supabase.from('expense_reports').update({ status }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status: ' + error.message); return; }
    toast.success(`Reembolso marcado como ${STATUS_META[status].label}`);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (detailReport?.id === id) setDetailReport({ ...detailReport, status });
  };

  const exportReportPdf = async (report: Report) => {
    const toastId = toast.loading('Gerando PDF...');
    try {
      const reportItems = items[report.id] || [];
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // ---- Summary page ----
      let page = pdfDoc.addPage([595.28, 841.89]); // A4
      const width = page.getWidth();
      const height = page.getHeight();
      let y = height - 50;
      const drawText = (text: string, opts: { x?: number; size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
        page.drawText(text, {
          x: opts.x ?? 50,
          y,
          size: opts.size ?? 10,
          font: opts.bold ? fontBold : font,
          color: rgb(...(opts.color ?? [0, 0, 0])),
        });
      };
      const line = (h = 14) => { y -= h; if (y < 60) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; } };

      drawText('Relatório de Reembolso', { size: 18, bold: true }); line(24);
      drawText(report.title, { size: 13, bold: true }); line(20);

      drawText(`Colaborador: ${report.user_name || '—'}`); line();
      drawText(`E-mail: ${report.user_email || '—'}`); line();
      drawText(`Destino: ${report.trip_destination || '—'}`); line();
      const period = `${report.trip_start_date ? format(new Date(report.trip_start_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'} até ${report.trip_end_date ? format(new Date(report.trip_end_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}`;
      drawText(`Período: ${period}`); line();
      drawText(`Status: ${STATUS_META[report.status].label}`); line();
      drawText(`Criado em: ${format(new Date(report.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`); line(20);

      const advance = Number(report.company_advance || 0);
      const spent = Number(report.total_spent || 0);
      const diff = spent - advance;
      drawText(`Adiantado pela empresa: ${formatBRL(advance)}`, { bold: true }); line();
      drawText(`Total gasto: ${formatBRL(spent)}`, { bold: true }); line();
      drawText(`${diff >= 0 ? 'Reembolsar ao colaborador' : 'Devolver à empresa'}: ${formatBRL(Math.abs(diff))}`, { bold: true, color: diff >= 0 ? [0.05, 0.5, 0.3] : [0.7, 0.4, 0] }); line(24);

      if (report.notes) {
        drawText('Observações:', { bold: true }); line();
        const words = report.notes.split(/\s+/);
        let lineText = '';
        for (const w of words) {
          if ((lineText + ' ' + w).length > 90) { drawText(lineText); line(); lineText = w; }
          else lineText = lineText ? lineText + ' ' + w : w;
        }
        if (lineText) { drawText(lineText); line(); }
        line(10);
      }

      drawText(`Itens (${reportItems.length})`, { size: 12, bold: true }); line(18);
      drawText('Data', { x: 50, bold: true });
      drawText('Categoria', { x: 110, bold: true });
      drawText('Descrição', { x: 210, bold: true });
      drawText('Valor', { x: 470, bold: true });
      line();
      page.drawLine({ start: { x: 50, y: y + 6 }, end: { x: width - 50, y: y + 6 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      for (const it of reportItems) {
        const date = it.expense_date ? format(new Date(it.expense_date), 'dd/MM/yy', { locale: ptBR }) : '—';
        const desc = (it.description || '—').slice(0, 45);
        drawText(date, { x: 50 });
        drawText((it.category || '').slice(0, 16), { x: 110 });
        drawText(desc, { x: 210 });
        drawText(formatBRL(Number(it.amount || 0)), { x: 470 });
        line();
      }

      // ---- Attach receipts ----
      for (const it of reportItems) {
        if (!it.receipt_url) continue;
        try {
          const resp = await fetch(it.receipt_url);
          if (!resp.ok) continue;
          const buf = new Uint8Array(await resp.arrayBuffer());
          const ct = (resp.headers.get('content-type') || '').toLowerCase();
          const isPdf = ct.includes('pdf') || it.receipt_url.toLowerCase().includes('.pdf');
          const isJpg = ct.includes('jpeg') || /\.jpe?g($|\?)/i.test(it.receipt_url);
          const isPng = ct.includes('png') || /\.png($|\?)/i.test(it.receipt_url);

          if (isPdf) {
            const src = await PDFDocument.load(buf, { ignoreEncryption: true });
            const pages = await pdfDoc.copyPages(src, src.getPageIndices());
            pages.forEach(p => pdfDoc.addPage(p));
          } else if (isJpg || isPng) {
            const img = isJpg ? await pdfDoc.embedJpg(buf) : await pdfDoc.embedPng(buf);
            const p = pdfDoc.addPage([595.28, 841.89]);
            const maxW = p.getWidth() - 80;
            const maxH = p.getHeight() - 120;
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            const w = img.width * scale;
            const h = img.height * scale;
            p.drawText(`Comprovante — ${it.category} — ${formatBRL(Number(it.amount || 0))}`, {
              x: 40, y: p.getHeight() - 40, size: 10, font: fontBold,
            });
            p.drawImage(img, { x: (p.getWidth() - w) / 2, y: (p.getHeight() - h) / 2 - 20, width: w, height: h });
          }
        } catch (e) {
          console.warn('Falha ao anexar comprovante', it.id, e);
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = (report.user_name || 'reembolso').replace(/[^a-z0-9]+/gi, '_');
      a.href = url;
      a.download = `reembolso_${safe}_${report.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso', { id: toastId });
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || 'desconhecido'), { id: toastId });
    }
  };

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (statusFilter !== 'todos' && r.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.user_name || '').toLowerCase().includes(q) ||
        (r.user_email || '').toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.trip_destination || '').toLowerCase().includes(q)
      );
    });
  }, [reports, search, statusFilter]);

  const kpis = useMemo(() => {
    const acc = { pendente: 0, aprovado: 0, rejeitado: 0, pago: 0, total: 0 };
    reports.forEach(r => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      acc.total += r.total_spent || 0;
    });
    return acc;
  }, [reports]);

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Financeiro · Reembolsos</h1>
            <p className="text-sm text-muted-foreground">
              Aprove, rejeite ou marque como pago os reembolsos solicitados pelos colaboradores.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['pendente', 'aprovado', 'rejeitado', 'pago'] as ExpenseStatus[]).map(s => {
            const Icon = STATUS_META[s].icon;
            return (
              <Card key={s}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground uppercase">{STATUS_META[s].label}</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">{kpis[s] || 0}</p>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">Total gasto</p>
              <p className="text-xl font-bold mt-1">{formatBRL(kpis.total)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, e-mail, título ou destino..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitações ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">
                Nenhuma solicitação encontrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Viagem</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Adiantado</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">Reembolsar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => {
                      const diff = (r.total_spent || 0) - Number(r.company_advance || 0);
                      const meta = STATUS_META[r.status];
                      const Icon = meta.icon;
                      return (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetailReport(r)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={r.user_avatar || undefined} />
                                <AvatarFallback>{(r.user_name || '?').charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{r.user_name}</p>
                                <p className="text-xs text-muted-foreground">{r.user_email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{r.title}</p>
                            {r.trip_destination && (
                              <p className="text-xs text-muted-foreground">{r.trip_destination}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.trip_start_date ? format(new Date(r.trip_start_date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                            {' → '}
                            {r.trip_end_date ? format(new Date(r.trip_end_date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                          </TableCell>
                          <TableCell className="text-right">{formatBRL(Number(r.company_advance || 0))}</TableCell>
                          <TableCell className="text-right">{formatBRL(r.total_spent || 0)}</TableCell>
                          <TableCell className={`text-right font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {formatBRL(Math.abs(diff))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>
                              <Icon className="w-3 h-3 mr-1" />
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as ExpenseStatus)}>
                              <SelectTrigger className="w-[130px] ml-auto h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="aprovado">Aprovar</SelectItem>
                                <SelectItem value="rejeitado">Rejeitar</SelectItem>
                                <SelectItem value="pago">Marcar como pago</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailReport} onOpenChange={(o) => { if (!o) setDetailReport(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailReport && (
            <>
              <DialogHeader>
                <DialogTitle>{detailReport.title}</DialogTitle>
                <DialogDescription>
                  {detailReport.user_name} · {detailReport.trip_destination || 'Sem destino'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase">Adiantado</p>
                    <p className="font-bold">{formatBRL(Number(detailReport.company_advance || 0))}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase">Total gasto</p>
                    <p className="font-bold">{formatBRL(detailReport.total_spent || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase">Diferença</p>
                    <p className="font-bold">
                      {formatBRL(Math.abs((detailReport.total_spent || 0) - Number(detailReport.company_advance || 0)))}
                    </p>
                  </div>
                </div>

                {detailReport.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{detailReport.notes}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-2">Itens ({(items[detailReport.id] || []).length})</p>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Comprovante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(items[detailReport.id] || []).map(it => (
                          <TableRow key={it.id}>
                            <TableCell className="text-xs">
                              {it.expense_date ? format(new Date(it.expense_date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                            </TableCell>
                            <TableCell className="text-xs">{it.category}</TableCell>
                            <TableCell className="text-xs">{it.description || '—'}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatBRL(Number(it.amount || 0))}</TableCell>
                            <TableCell className="text-right">
                              {it.receipt_url ? (
                                <a href={it.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                  Ver <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatus(detailReport.id, 'pendente')}
                    disabled={detailReport.status === 'pendente'}
                  >
                    <Clock className="w-4 h-4 mr-1" /> Pendente
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => updateStatus(detailReport.id, 'aprovado')}
                    disabled={detailReport.status === 'aprovado'}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateStatus(detailReport.id, 'rejeitado')}
                    disabled={detailReport.status === 'rejeitado'}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => updateStatus(detailReport.id, 'pago')}
                    disabled={detailReport.status === 'pago'}
                  >
                    <BadgeDollarSign className="w-4 h-4 mr-1" /> Marcar como pago
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default FinanceiroReembolsos;
