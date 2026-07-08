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
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import logoUrl from '@/assets/logo-white.png';

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

      // Embed logo (preserving aspect ratio)
      let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
      try {
        const logoBytes = await fetch(logoUrl).then(r => r.arrayBuffer());
        logoImg = await pdfDoc.embedPng(new Uint8Array(logoBytes));
      } catch (e) {
        console.warn('Logo indisponível', e);
      }

      // Page constants
      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const MARGIN = 50;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const BRAND = rgb(0, 0, 0); // preto
      const MUTED = rgb(0.45, 0.45, 0.45);
      const LINE = rgb(0.85, 0.85, 0.85);

      // Word wrap helper
      const wrap = (text: string, maxWidth: number, size: number, f: PDFFont): string[] => {
        const words = (text || '').replace(/\s+/g, ' ').trim().split(' ');
        if (!words[0]) return [];
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const test = cur ? cur + ' ' + w : w;
          if (f.widthOfTextAtSize(test, size) <= maxWidth) cur = test;
          else {
            if (cur) lines.push(cur);
            // hard-break long single word
            if (f.widthOfTextAtSize(w, size) > maxWidth) {
              let chunk = '';
              for (const ch of w) {
                if (f.widthOfTextAtSize(chunk + ch, size) > maxWidth) { lines.push(chunk); chunk = ch; }
                else chunk += ch;
              }
              cur = chunk;
            } else cur = w;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      let pageNum = 0;
      const pages: PDFPage[] = [];
      const newPage = (): PDFPage => {
        const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
        pages.push(p);
        pageNum++;
        // Header band
        p.drawRectangle({ x: 0, y: PAGE_H - 80, width: PAGE_W, height: 80, color: BRAND });
        if (logoImg) {
          const lh = 44;
          const lw = (logoImg.width / logoImg.height) * lh;
          p.drawImage(logoImg, { x: MARGIN, y: PAGE_H - 62, width: lw, height: lh });
        }
        p.drawText('Relatório de Reembolso', {
          x: PAGE_W - MARGIN - fontBold.widthOfTextAtSize('Relatório de Reembolso', 14),
          y: PAGE_H - 45, size: 14, font: fontBold, color: rgb(1, 1, 1),
        });
        const sub = `Nº ${report.id.slice(0, 8).toUpperCase()}`;
        p.drawText(sub, {
          x: PAGE_W - MARGIN - font.widthOfTextAtSize(sub, 9),
          y: PAGE_H - 62, size: 9, font, color: rgb(0.9, 0.95, 0.92),
        });
        return p;
      };

      let page = newPage();
      let y = PAGE_H - 110;

      const ensureSpace = (needed: number) => {
        if (y - needed < 70) { page = newPage(); y = PAGE_H - 110; }
      };

      const drawLine = (text: string, opts: { size?: number; bold?: boolean; color?: any; x?: number; gap?: number } = {}) => {
        const size = opts.size ?? 10;
        ensureSpace(size + 4);
        page.drawText(text, {
          x: opts.x ?? MARGIN, y,
          size, font: opts.bold ? fontBold : font,
          color: opts.color ?? rgb(0.15, 0.15, 0.15),
        });
        y -= (opts.gap ?? size + 5);
      };

      const drawKV = (label: string, value: string) => {
        ensureSpace(16);
        page.drawText(label, { x: MARGIN, y, size: 9, font: fontBold, color: MUTED });
        page.drawText(value || '—', { x: MARGIN + 110, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 16;
      };

      const sectionTitle = (t: string) => {
        y -= 6;
        ensureSpace(24);
        page.drawText(t, { x: MARGIN, y, size: 11, font: fontBold, color: BRAND });
        y -= 4;
        page.drawLine({ start: { x: MARGIN, y: y }, end: { x: PAGE_W - MARGIN, y: y }, thickness: 0.6, color: BRAND });
        y -= 14;
      };

      // ---- Title block ----
      drawLine(report.title, { size: 15, bold: true, gap: 22 });

      sectionTitle('Dados do Colaborador');
      drawKV('Colaborador:', report.user_name || '—');
      drawKV('E-mail:', report.user_email || '—');

      sectionTitle('Viagem');
      drawKV('Destino:', report.trip_destination || '—');
      const period = `${report.trip_start_date ? format(new Date(report.trip_start_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'} até ${report.trip_end_date ? format(new Date(report.trip_end_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}`;
      drawKV('Período:', period);
      drawKV('Status:', STATUS_META[report.status].label);
      drawKV('Criado em:', format(new Date(report.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }));

      sectionTitle('Resumo Financeiro');
      const advance = Number(report.company_advance || 0);
      const spent = Number(report.total_spent || 0);
      const diff = spent - advance;
      drawKV('Adiantado:', formatBRL(advance));
      drawKV('Total gasto:', formatBRL(spent));
      ensureSpace(20);
      const diffLabel = diff >= 0 ? 'Reembolsar ao colaborador:' : 'Devolver à empresa:';
      const diffColor = diff >= 0 ? rgb(0.05, 0.5, 0.3) : rgb(0.75, 0.35, 0.05);
      page.drawText(diffLabel, { x: MARGIN, y, size: 10, font: fontBold, color: diffColor });
      page.drawText(formatBRL(Math.abs(diff)), { x: MARGIN + 180, y, size: 11, font: fontBold, color: diffColor });
      y -= 22;

      if (report.notes) {
        sectionTitle('Observações');
        const lines = wrap(report.notes, CONTENT_W, 10, font);
        for (const ln of lines) drawLine(ln, { size: 10 });
      }

      // ---- Items table ----
      sectionTitle(`Itens (${reportItems.length})`);
      const COLS = { date: MARGIN, cat: MARGIN + 60, desc: MARGIN + 160, val: PAGE_W - MARGIN - 70 };
      const DESC_W = COLS.val - COLS.desc - 10;

      const drawTableHeader = () => {
        ensureSpace(22);
        page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 18, color: rgb(0.95, 0.97, 0.95) });
        page.drawText('Data', { x: COLS.date + 4, y: y + 2, size: 9, font: fontBold, color: BRAND });
        page.drawText('Categoria', { x: COLS.cat, y: y + 2, size: 9, font: fontBold, color: BRAND });
        page.drawText('Descrição', { x: COLS.desc, y: y + 2, size: 9, font: fontBold, color: BRAND });
        page.drawText('Valor', { x: COLS.val, y: y + 2, size: 9, font: fontBold, color: BRAND });
        y -= 20;
      };
      drawTableHeader();

      for (const it of reportItems) {
        const date = it.expense_date ? format(new Date(it.expense_date), 'dd/MM/yy', { locale: ptBR }) : '—';
        const cat = (it.category || '').slice(0, 14);
        const descLines = wrap(it.description || '—', DESC_W, 9, font);
        const rowH = Math.max(14, descLines.length * 11 + 4);
        if (y - rowH < 70) { page = newPage(); y = PAGE_H - 110; drawTableHeader(); }
        page.drawText(date, { x: COLS.date + 4, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(cat, { x: COLS.cat, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        let dy = y;
        for (const ln of descLines) {
          page.drawText(ln, { x: COLS.desc, y: dy, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
          dy -= 11;
        }
        page.drawText(formatBRL(Number(it.amount || 0)), { x: COLS.val, y, size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
        y -= rowH;
        page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.3, color: LINE });
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
            const copied = await pdfDoc.copyPages(src, src.getPageIndices());
            copied.forEach(p => { pdfDoc.addPage(p); pages.push(p); });
          } else if (isJpg || isPng) {
            const img = isJpg ? await pdfDoc.embedJpg(buf) : await pdfDoc.embedPng(buf);
            const p = newPage();
            const caption = `Comprovante — ${it.category} — ${formatBRL(Number(it.amount || 0))}`;
            p.drawText(caption, { x: MARGIN, y: PAGE_H - 105, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
            const maxW = CONTENT_W;
            const maxH = PAGE_H - 180;
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            const w = img.width * scale;
            const h = img.height * scale;
            p.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - 130 - h) / 2 + 20, width: w, height: h });
          }
        } catch (e) {
          console.warn('Falha ao anexar comprovante', it.id, e);
        }
      }

      // ---- Footer with page numbers ----
      const total = pages.length;
      pages.forEach((p, i) => {
        const txt = `Página ${i + 1} de ${total}  •  Digitale Têxtil  •  Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`;
        p.drawText(txt, {
          x: MARGIN, y: 30, size: 8, font, color: MUTED,
        });
        p.drawLine({ start: { x: MARGIN, y: 45 }, end: { x: PAGE_W - MARGIN, y: 45 }, thickness: 0.4, color: LINE });
      });

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
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                title="Exportar PDF com comprovantes"
                                onClick={() => exportReportPdf(r)}
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as ExpenseStatus)}>
                                <SelectTrigger className="w-[130px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="aprovado">Aprovar</SelectItem>
                                  <SelectItem value="rejeitado">Rejeitar</SelectItem>
                                  <SelectItem value="pago">Marcar como pago</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
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
                    variant="secondary"
                    size="sm"
                    onClick={() => exportReportPdf(detailReport)}
                  >
                    <FileDown className="w-4 h-4 mr-1" /> Exportar PDF
                  </Button>
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
