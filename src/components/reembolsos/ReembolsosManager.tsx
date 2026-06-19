import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Upload, FileText, Receipt, ChevronDown, ChevronUp, Loader2,
  Utensils, Fuel, Hotel, Car, MapPin, MoreHorizontal, ExternalLink, Pencil, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExpenseCategory =
  | 'alimentacao' | 'combustivel' | 'pedagio' | 'hotel' | 'aluguel_carro' | 'uber' | 'outros';

const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: React.ElementType; color: string }> = {
  alimentacao: { label: 'Alimentação', icon: Utensils, color: 'bg-orange-500/10 text-orange-600' },
  combustivel: { label: 'Combustível', icon: Fuel, color: 'bg-red-500/10 text-red-600' },
  pedagio: { label: 'Pedágio', icon: MapPin, color: 'bg-yellow-500/10 text-yellow-700' },
  hotel: { label: 'Hotel', icon: Hotel, color: 'bg-blue-500/10 text-blue-600' },
  aluguel_carro: { label: 'Aluguel de Carro', icon: Car, color: 'bg-purple-500/10 text-purple-600' },
  uber: { label: 'Uber / Táxi', icon: Car, color: 'bg-slate-500/10 text-slate-700' },
  outros: { label: 'Outros', icon: MoreHorizontal, color: 'bg-gray-500/10 text-gray-700' },
};

interface ExpenseReport {
  id: string;
  user_id: string;
  title: string;
  trip_destination: string | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
  company_advance: number;
  status: string;
  notes: string | null;
  created_at: string;
}
interface ExpenseItem {
  id: string;
  report_id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string | null;
  receipt_url: string | null;
  receipt_path: string | null;
}

interface DraftItem {
  category: ExpenseCategory;
  description: string;
  amount: string;
  expense_date: string;
  file: File | null;
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  aprovado: { label: 'Aprovado', variant: 'default' },
  rejeitado: { label: 'Rejeitado', variant: 'destructive' },
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

interface Props {
  userId: string;
  canEdit: boolean;
  canDelete?: boolean;
  isAdminView?: boolean;
  userName?: string;
}

const ReembolsosManager: React.FC<Props> = ({ userId, canEdit, canDelete = false, isAdminView, userName }) => {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [items, setItems] = useState<Record<string, ExpenseItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ExpenseReport | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');
  const [drafts, setDrafts] = useState<DraftItem[]>([
    { category: 'alimentacao', description: '', amount: '', expense_date: '', file: null },
  ]);

  const fetchAll = async () => {
    setLoading(true);
    const { data: reps, error } = await supabase
      .from('expense_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar reembolsos'); setLoading(false); return; }
    setReports(reps || []);
    if (reps && reps.length > 0) {
      const { data: its } = await supabase
        .from('expense_items')
        .select('*')
        .in('report_id', reps.map(r => r.id));
      const grouped: Record<string, ExpenseItem[]> = {};
      (its || []).forEach(it => {
        (grouped[it.report_id] ||= []).push(it as ExpenseItem);
      });
      setItems(grouped);
    } else {
      setItems({});
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [userId]);

  const resetForm = () => {
    setTitle(''); setDestination(''); setStartDate(''); setEndDate('');
    setAdvance(''); setNotes('');
    setDrafts([{ category: 'alimentacao', description: '', amount: '', expense_date: '', file: null }]);
    setEditingReport(null);
  };

  const openNewDialog = () => { resetForm(); setDialogOpen(true); };

  const openEditDialog = (rep: ExpenseReport) => {
    setEditingReport(rep);
    setTitle(rep.title);
    setDestination(rep.trip_destination || '');
    setStartDate(rep.trip_start_date || '');
    setEndDate(rep.trip_end_date || '');
    setAdvance(String(rep.company_advance));
    setNotes(rep.notes || '');
    setDrafts([]); // when editing, new items only appended via separate add
    setDialogOpen(true);
  };

  const addDraftRow = () =>
    setDrafts(d => [...d, { category: 'alimentacao', description: '', amount: '', expense_date: '', file: null }]);

  const updateDraft = (i: number, patch: Partial<DraftItem>) =>
    setDrafts(d => d.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const removeDraft = (i: number) => setDrafts(d => d.filter((_, idx) => idx !== i));

  const draftTotal = useMemo(
    () => drafts.reduce((s, d) => s + (parseFloat(d.amount.replace(',', '.')) || 0), 0),
    [drafts]
  );
  const advanceNum = parseFloat(advance.replace(',', '.')) || 0;
  const diff = draftTotal - advanceNum; // >0 empresa deve reembolsar; <0 funcionário devolve

  const uploadReceipt = async (file: File): Promise<{ url: string | null; path: string | null }> => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('reembolsos').upload(path, file);
    if (error) { toast.error('Erro ao enviar comprovante'); return { url: null, path: null }; }
    const { data } = await supabase.storage.from('reembolsos').createSignedUrl(path, 60 * 60 * 24 * 365);
    return { url: data?.signedUrl || null, path };
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Informe um título para a viagem'); return; }
    setSaving(true);
    try {
      let reportId = editingReport?.id;
      if (editingReport) {
        const { error } = await supabase.from('expense_reports').update({
          title, trip_destination: destination || null,
          trip_start_date: startDate || null, trip_end_date: endDate || null,
          company_advance: advanceNum, notes: notes || null,
        }).eq('id', editingReport.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('expense_reports').insert({
          user_id: userId, title, trip_destination: destination || null,
          trip_start_date: startDate || null, trip_end_date: endDate || null,
          company_advance: advanceNum, notes: notes || null,
        }).select('id').single();
        if (error) throw error;
        reportId = data.id;
      }

      // Insert any drafts
      for (const d of drafts) {
        if (!d.amount && !d.description && !d.file) continue;
        let url: string | null = null, path: string | null = null;
        if (d.file) {
          const up = await uploadReceipt(d.file);
          url = up.url; path = up.path;
        }
        const { error } = await supabase.from('expense_items').insert({
          report_id: reportId!,
          category: d.category,
          description: d.description || null,
          amount: parseFloat(d.amount.replace(',', '.')) || 0,
          expense_date: d.expense_date || null,
          receipt_url: url, receipt_path: path,
        });
        if (error) throw error;
      }

      toast.success(editingReport ? 'Reembolso atualizado' : 'Reembolso criado');
      setDialogOpen(false);
      resetForm();
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar: ' + (e.message || ''));
    } finally { setSaving(false); }
  };

  const handleDeleteReport = async (id: string) => {
    const its = items[id] || [];
    for (const it of its) {
      if (it.receipt_path) await supabase.storage.from('reembolsos').remove([it.receipt_path]);
    }
    const { error } = await supabase.from('expense_reports').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Reembolso excluído');
    fetchAll();
  };

  const handleDeleteItem = async (it: ExpenseItem) => {
    if (it.receipt_path) await supabase.storage.from('reembolsos').remove([it.receipt_path]);
    const { error } = await supabase.from('expense_items').delete().eq('id', it.id);
    if (error) { toast.error('Erro ao excluir item'); return; }
    fetchAll();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('expense_reports').update({ status }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success('Status atualizado');
    fetchAll();
  };

  const exportReportCSV = (rep: ExpenseReport) => {
    const its = items[rep.id] || [];
    const total = its.reduce((s, i) => s + Number(i.amount || 0), 0);
    const adv = Number(rep.company_advance || 0);
    const diff = total - adv;
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push(`Relatório de Reembolso`);
    lines.push(`Título;${esc(rep.title)}`);
    lines.push(`Destino;${esc(rep.trip_destination || '')}`);
    lines.push(`Início;${esc(rep.trip_start_date || '')}`);
    lines.push(`Término;${esc(rep.trip_end_date || '')}`);
    lines.push(`Status;${esc(STATUS_META[rep.status]?.label || rep.status)}`);
    lines.push(`Adiantado (R$);${adv.toFixed(2).replace('.', ',')}`);
    lines.push(`Total Gasto (R$);${total.toFixed(2).replace('.', ',')}`);
    lines.push(`${diff >= 0 ? 'Empresa Reembolsa' : 'Funcionário Devolve'} (R$);${Math.abs(diff).toFixed(2).replace('.', ',')}`);
    if (rep.notes) lines.push(`Observações;${esc(rep.notes)}`);
    lines.push('');
    lines.push('Data;Categoria;Descrição;Valor (R$);Comprovante');
    its.forEach(it => {
      const meta = CATEGORY_META[it.category] || CATEGORY_META.outros;
      lines.push([
        esc(it.expense_date || ''),
        esc(meta.label),
        esc(it.description || ''),
        Number(it.amount || 0).toFixed(2).replace('.', ','),
        esc(it.receipt_url || ''),
      ].join(';'));
    });
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = rep.title.replace(/[^\w\-]+/g, '_').slice(0, 40);
    a.href = url;
    a.download = `reembolso-${safeTitle}-${format(new Date(rep.created_at), 'yyyyMMdd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado');
  };

  // Totals per report
  const totalsFor = (id: string) => {
    const its = items[id] || [];
    const total = its.reduce((s, i) => s + Number(i.amount || 0), 0);
    const rep = reports.find(r => r.id === id);
    const adv = Number(rep?.company_advance || 0);
    return { total, adv, diff: total - adv };
  };

  const globalTotals = useMemo(() => {
    let totalSpent = 0, totalAdvance = 0;
    reports.forEach(r => {
      totalAdvance += Number(r.company_advance || 0);
      totalSpent += (items[r.id] || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    });
    return { totalSpent, totalAdvance, diff: totalSpent - totalAdvance };
  }, [reports, items]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Recebido</p>
            <p className="text-2xl font-bold mt-1">{formatBRL(globalTotals.totalAdvance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Gasto</p>
            <p className="text-2xl font-bold mt-1">{formatBRL(globalTotals.totalSpent)}</p>
          </CardContent>
        </Card>
        <Card className={globalTotals.diff >= 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {globalTotals.diff >= 0 ? 'Empresa reembolsa' : 'Funcionário devolve'}
            </p>
            <p className="text-2xl font-bold mt-1">{formatBRL(Math.abs(globalTotals.diff))}</p>
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={openNewDialog} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Solicitação
          </Button>
        </div>
      )}

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Nenhuma solicitação de reembolso até o momento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(rep => {
            const t = totalsFor(rep.id);
            const its = items[rep.id] || [];
            const isOpen = expanded === rep.id;
            const statusMeta = STATUS_META[rep.status] || STATUS_META.pendente;
            return (
              <Card key={rep.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{rep.title}</CardTitle>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </div>
                      <CardDescription className="mt-1">
                        {rep.trip_destination && <span>{rep.trip_destination} · </span>}
                        {rep.trip_start_date && format(new Date(rep.trip_start_date + 'T00:00:00'), 'dd/MM/yyyy')}
                        {rep.trip_end_date && rep.trip_end_date !== rep.trip_start_date &&
                          ` → ${format(new Date(rep.trip_end_date + 'T00:00:00'), 'dd/MM/yyyy')}`}
                      </CardDescription>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-xs text-muted-foreground">Gasto: <span className="font-semibold text-foreground">{formatBRL(t.total)}</span></p>
                      <p className="text-xs text-muted-foreground">Recebido: {formatBRL(t.adv)}</p>
                      <p className={`text-sm font-bold ${t.diff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {t.diff >= 0 ? 'Receber: ' : 'Devolver: '}{formatBRL(Math.abs(t.diff))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : rep.id)} className="gap-1">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {its.length} {its.length === 1 ? 'item' : 'itens'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => exportReportCSV(rep)} disabled={its.length === 0}>
                      <Download className="w-3.5 h-3.5" /> Exportar
                    </Button>
                    {canEdit && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openEditDialog(rep)}>
                          <Pencil className="w-3.5 h-3.5" /> Adicionar item
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação remove a solicitação e todos os comprovantes anexados.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteReport(rep.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {isAdminView && (
                      <Select value={rep.status} onValueChange={(v) => handleStatusChange(rep.id, v)}>
                        <SelectTrigger className="h-8 w-36 ml-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="rejeitado">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0">
                    {its.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">Sem itens cadastrados.</p>
                    ) : (
                      <div className="divide-y divide-border border rounded-lg">
                        {its.map(it => {
                          const meta = CATEGORY_META[it.category] || CATEGORY_META.outros;
                          const Icon = meta.icon;
                          return (
                            <div key={it.id} className="flex items-center gap-3 p-3">
                              <div className={`p-2 rounded-lg ${meta.color}`}><Icon className="w-4 h-4" /></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{meta.label}</p>
                                {it.description && <p className="text-xs text-muted-foreground truncate">{it.description}</p>}
                                {it.expense_date && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {format(new Date(it.expense_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">{formatBRL(Number(it.amount))}</p>
                              </div>
                              {it.receipt_url && (
                                <a href={it.receipt_url} target="_blank" rel="noreferrer">
                                  <Button size="sm" variant="ghost" className="gap-1">
                                    <FileText className="w-3.5 h-3.5" /> Ver
                                  </Button>
                                </a>
                              )}
                              {canDelete && (
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteItem(it)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {rep.notes && (
                      <p className="text-xs text-muted-foreground mt-3 italic">Obs: {rep.notes}</p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* New / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReport ? 'Editar Solicitação' : 'Nova Solicitação de Reembolso'}</DialogTitle>
            <DialogDescription>
              Informe os dados da viagem e os comprovantes de gastos. O sistema calcula automaticamente o valor a reembolsar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Título da viagem *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Visita cliente São Paulo" />
              </div>
              <div>
                <Label>Destino</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Cidade / Estado" />
              </div>
              <div>
                <Label>Valor adiantado pela empresa (R$)</Label>
                <Input inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Data de início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Data de término</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">Itens de despesa</Label>
                <Button type="button" size="sm" variant="outline" onClick={addDraftRow} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </Button>
              </div>
              {drafts.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum item novo. Clique em "Adicionar" para incluir despesas.</p>
              )}
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/30">
                    <div className="col-span-12 sm:col-span-3">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={d.category} onValueChange={(v) => updateDraft(i, { category: v as ExpenseCategory })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_META).map(([k, m]) => (
                            <SelectItem key={k} value={k}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-7 sm:col-span-4">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={d.description} onChange={(e) => updateDraft(i, { description: e.target.value })} placeholder="Detalhe do gasto" />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input inputMode="decimal" value={d.amount} onChange={(e) => updateDraft(i, { amount: e.target.value })} placeholder="0,00" />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="text-xs">Data</Label>
                      <Input type="date" value={d.expense_date} onChange={(e) => updateDraft(i, { expense_date: e.target.value })} />
                    </div>
                    <div className="col-span-6 sm:col-span-1 flex justify-end">
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeDraft(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="col-span-12">
                      <Label className="text-xs flex items-center gap-1"><Upload className="w-3 h-3" /> Comprovante</Label>
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => updateDraft(i, { file: e.target.files?.[0] || null })}
                      />
                      {d.file && <p className="text-[11px] text-muted-foreground mt-1">{d.file.name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Adiantado</p>
                <p className="font-bold">{formatBRL(advanceNum)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Total gasto (novos itens)</p>
                <p className="font-bold">{formatBRL(draftTotal)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">{diff >= 0 ? 'Reembolso devido' : 'Devolução à empresa'}</p>
                <p className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{formatBRL(Math.abs(diff))}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingReport ? 'Salvar alterações' : 'Criar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReembolsosManager;
