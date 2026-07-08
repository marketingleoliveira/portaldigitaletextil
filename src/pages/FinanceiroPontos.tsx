import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Clock, Search, Loader2, Download, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  total_records: number;
  first_date: string | null;
  last_date: string | null;
}

interface TimeRecord {
  id: string;
  record_date: string;
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
}

const calculateWorkedHours = (r: TimeRecord) => {
  let morning = 0, afternoon = 0;
  if (r.entry_time && r.lunch_exit_time) {
    morning = Math.max(0, (new Date(r.lunch_exit_time).getTime() - new Date(r.entry_time).getTime()) / 60000);
  }
  if (r.lunch_return_time && r.exit_time) {
    afternoon = Math.max(0, (new Date(r.exit_time).getTime() - new Date(r.lunch_return_time).getTime()) / 60000);
  }
  const total = morning + afternoon;
  const fmt = (m: number) => `${Math.floor(m / 60)}h${Math.round(m % 60).toString().padStart(2, '0')}min`;
  return { total: total > 0 ? fmt(total) : '-', totalMinutes: total };
};

const FinanceiroPontos: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { realRole } = useAuth();
  const isDev = realRole === 'dev';

  const deleteUserRecords = async (u: UserRow) => {
    const toastId = toast.loading('Excluindo registros de ponto...');
    try {
      const { error } = await supabase.from('time_records').delete().eq('user_id', u.id);
      if (error) throw error;
      toast.success(`Registros de ponto de ${u.full_name} excluídos do sistema`, { id: toastId });
      setRows(prev => prev.filter(r => r.id !== u.id));
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + (e?.message || ''), { id: toastId });
    }
  };
    const load = async () => {
      setLoading(true);
      try {
        const { data: recs, error } = await supabase
          .from('time_records')
          .select('user_id, record_date')
          .order('record_date', { ascending: false });
        if (error) throw error;

        const agg = new Map<string, { count: number; first: string; last: string }>();
        for (const r of recs || []) {
          const cur = agg.get(r.user_id);
          if (!cur) agg.set(r.user_id, { count: 1, first: r.record_date, last: r.record_date });
          else {
            cur.count++;
            if (r.record_date < cur.first) cur.first = r.record_date;
            if (r.record_date > cur.last) cur.last = r.record_date;
          }
        }
        const ids = Array.from(agg.keys());
        if (ids.length === 0) { setRows([]); return; }

        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', ids);

        const merged: UserRow[] = (profs || []).map(p => {
          const a = agg.get(p.id)!;
          return {
            id: p.id,
            full_name: p.full_name || 'Sem nome',
            email: p.email || '',
            avatar_url: p.avatar_url,
            total_records: a.count,
            first_date: a.first,
            last_date: a.last,
          };
        }).sort((a, b) => (b.last_date || '').localeCompare(a.last_date || ''));

        setRows(merged);
      } catch (e: any) {
        toast.error('Erro ao carregar pontos: ' + (e?.message || ''));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const fetchAllRecords = async (userId: string): Promise<TimeRecord[]> => {
    const { data, error } = await supabase
      .from('time_records')
      .select('*')
      .eq('user_id', userId)
      .order('record_date', { ascending: true });
    if (error) throw error;
    return (data || []) as TimeRecord[];
  };

  const exportCSV = async (u: UserRow) => {
    setExportingId(u.id + ':csv');
    try {
      const data = await fetchAllRecords(u.id);
      if (data.length === 0) { toast.info('Nenhum registro encontrado.'); return; }
      const headers = ['Data', 'Entrada', 'Saída Almoço', 'Retorno Almoço', 'Saída', 'Total Dia'];
      const rows = data.map(r => [
        format(new Date(r.record_date + 'T00:00:00'), 'dd/MM/yyyy'),
        r.entry_time ? format(new Date(r.entry_time), 'HH:mm') : '',
        r.lunch_exit_time ? format(new Date(r.lunch_exit_time), 'HH:mm') : '',
        r.lunch_return_time ? format(new Date(r.lunch_return_time), 'HH:mm') : '',
        r.exit_time ? format(new Date(r.exit_time), 'HH:mm') : '',
        calculateWorkedHours(r).total,
      ]);
      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ponto_${u.full_name.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error('Erro ao gerar CSV: ' + (e?.message || ''));
    } finally {
      setExportingId(null);
    }
  };

  const exportPDF = async (u: UserRow) => {
    setExportingId(u.id + ':pdf');
    try {
      const data = await fetchAllRecords(u.id);
      if (data.length === 0) { toast.info('Nenhum registro encontrado.'); return; }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      try {
        const logoUrl = (await import('@/assets/logo-digitale-full.png')).default;
        const loadImage = (src: string): Promise<{ dataUrl: string; w: number; h: number }> => new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.width, h: img.height });
          };
          img.onerror = reject;
          img.src = src;
        });
        const { dataUrl, w, h } = await loadImage(logoUrl);
        const targetH = 14;
        const targetW = (w / h) * targetH;
        doc.addImage(dataUrl, 'PNG', margin, 12, targetW, targetH);
      } catch { /* ignore */ }

      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE PONTO', pageWidth / 2, 25, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 32, { align: 'center' });

      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, 40, pageWidth - 2 * margin, 25, 3, 3, 'FD');
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('Colaborador:', margin + 5, 50);
      doc.setFont('helvetica', 'normal'); doc.text(u.full_name, margin + 45, 50);
      doc.setFont('helvetica', 'bold'); doc.text('Período:', margin + 5, 58);
      doc.setFont('helvetica', 'normal');
      const firstDate = format(new Date(data[0].record_date + 'T00:00:00'), 'dd/MM/yyyy');
      const lastDate = format(new Date(data[data.length - 1].record_date + 'T00:00:00'), 'dd/MM/yyyy');
      doc.text(`${firstDate} a ${lastDate}`, margin + 30, 58);
      doc.setFont('helvetica', 'bold'); doc.text('Total de registros:', pageWidth / 2 + 10, 58);
      doc.setFont('helvetica', 'normal'); doc.text(`${data.length} dias`, pageWidth / 2 + 55, 58);

      let totalMinutes = 0;
      const tableData = data.map(r => {
        const h = calculateWorkedHours(r);
        totalMinutes += h.totalMinutes;
        return [
          format(new Date(r.record_date + 'T00:00:00'), 'dd/MM/yyyy'),
          r.entry_time ? format(new Date(r.entry_time), 'HH:mm') : '-',
          r.lunch_exit_time ? format(new Date(r.lunch_exit_time), 'HH:mm') : '-',
          r.lunch_return_time ? format(new Date(r.lunch_return_time), 'HH:mm') : '-',
          r.exit_time ? format(new Date(r.exit_time), 'HH:mm') : '-',
          h.total,
        ];
      });
      const totalFmt = `${Math.floor(totalMinutes / 60)}h${Math.round(totalMinutes % 60).toString().padStart(2, '0')}min`;

      autoTable(doc, {
        startY: 72,
        head: [['Data', 'Entrada', 'Saída Almoço', 'Retorno', 'Saída', 'Total Dia']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 9 },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          5: { fontStyle: 'bold', textColor: [59, 130, 246] },
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => {
          doc.setFontSize(8); doc.setTextColor(150);
          doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 150;
      if (finalY + 60 > pageHeight - 80) doc.addPage();
      const summaryY = finalY + 15;
      doc.setDrawColor(59, 130, 246);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin, summaryY, pageWidth - 2 * margin, 20, 3, 3, 'FD');
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('TOTAL DE HORAS TRABALHADAS:', margin + 10, summaryY + 13);
      doc.setFontSize(14); doc.setTextColor(59, 130, 246);
      doc.text(totalFmt, pageWidth - margin - 10, summaryY + 13, { align: 'right' });

      const signatureY = summaryY + 40;
      doc.setTextColor(0); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.setDrawColor(100);
      doc.line(margin, signatureY + 20, margin + 70, signatureY + 20);
      doc.text('Assinatura do Colaborador', margin, signatureY + 28);
      doc.setFontSize(8); doc.text(u.full_name, margin, signatureY + 35);
      doc.setFontSize(10);
      doc.line(pageWidth - margin - 70, signatureY + 20, pageWidth - margin, signatureY + 20);
      doc.text('Assinatura do Administrativo', pageWidth - margin - 70, signatureY + 28);
      doc.text(`Data: ____/____/________`, pageWidth / 2 - 25, signatureY + 50);
      doc.setFontSize(7); doc.setTextColor(100);
      doc.text('Este documento é válido apenas com as assinaturas do colaborador e do responsável administrativo.',
        pageWidth / 2, signatureY + 60, { align: 'center' });

      doc.save(`ponto_${u.full_name.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + (e?.message || ''));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pontos</h1>
            <p className="text-sm text-muted-foreground">
              Relatórios de todos os colaboradores com registros de ponto no sistema.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">Colaboradores ({filtered.length})</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum colaborador com registros de ponto encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Primeiro Registro</TableHead>
                    <TableHead>Último Registro</TableHead>
                    <TableHead className="text-right">Exportar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback>{u.full_name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{u.full_name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{u.total_records} dias</Badge>
                      </TableCell>
                      <TableCell>
                        {u.first_date ? format(new Date(u.first_date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        {u.last_date ? format(new Date(u.last_date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportCSV(u)}
                            disabled={exportingId?.startsWith(u.id)}
                          >
                            {exportingId === u.id + ':csv'
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4 mr-1" />}
                            CSV
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => exportPDF(u)}
                            disabled={exportingId?.startsWith(u.id)}
                          >
                            {exportingId === u.id + ':pdf'
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <FileText className="h-4 w-4 mr-1" />}
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FinanceiroPontos;
