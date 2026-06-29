import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  fileName?: string | null;
  uploadedUrl?: string | null;
  uploadedPath?: string | null;
  uploading?: boolean;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
  const [itemEdit, setItemEdit] = useState<DraftItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  const openEditItem = (it: ExpenseItem) => {
    setEditingItem(it);
    setItemEdit({
      category: it.category,
      description: it.description || '',
      amount: String(it.amount ?? ''),
      expense_date: it.expense_date || '',
      file: null,
      fileName: it.receipt_path ? it.receipt_path.split('/').pop() : null,
      uploadedUrl: it.receipt_url,
      uploadedPath: it.receipt_path,
    });
  };

  const handleEditItemFilePick = async (file: File | null) => {
    if (!file) return;
    setItemEdit(prev => prev ? { ...prev, file, fileName: file.name, uploading: true } : prev);
    const up = await uploadReceipt(file);
    setItemEdit(prev => prev ? { ...prev, uploadedUrl: up.url, uploadedPath: up.path, uploading: false } : prev);
    if (up.path) toast.success('Comprovante enviado');
  };

  const saveEditedItem = async () => {
    if (!editingItem || !itemEdit) return;
    setSavingItem(true);
    try {
      // If a new receipt was uploaded, remove the previous file
      if (itemEdit.uploadedPath && editingItem.receipt_path && itemEdit.uploadedPath !== editingItem.receipt_path) {
        await supabase.storage.from('reembolsos').remove([editingItem.receipt_path]);
      }
      const { error } = await supabase.from('expense_items').update({
        category: itemEdit.category,
        description: itemEdit.description || null,
        amount: parseFloat(itemEdit.amount.replace(',', '.')) || 0,
        expense_date: itemEdit.expense_date || null,
        receipt_url: itemEdit.uploadedUrl,
        receipt_path: itemEdit.uploadedPath,
      }).eq('id', editingItem.id);
      if (error) throw error;
      toast.success('Item atualizado');
      setEditingItem(null);
      setItemEdit(null);
      await fetchAll();
    } catch (e: any) {
      toast.error('Erro ao atualizar item: ' + (e.message || ''));
    } finally { setSavingItem(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (prev.size === reports.length) return new Set();
      return new Set(reports.map(r => r.id));
    });
  };

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
    const { error } = await supabase.storage.from('reembolsos').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) { toast.error('Erro ao enviar comprovante: ' + error.message); return { url: null, path: null }; }
    const { data } = await supabase.storage.from('reembolsos').createSignedUrl(path, 60 * 60 * 24 * 365);
    return { url: data?.signedUrl || null, path };
  };

  // Upload immediately on file pick to preserve mobile gesture context and avoid page reloads
  const handleFilePick = async (i: number, file: File | null) => {
    if (!file) {
      setDrafts(d => d.map((x, idx) => idx === i ? { ...x, file: null, fileName: null, uploadedUrl: null, uploadedPath: null, uploading: false } : x));
      return;
    }
    setDrafts(d => d.map((x, idx) => idx === i ? { ...x, file, fileName: file.name, uploading: true } : x));
    const up = await uploadReceipt(file);
    setDrafts(d => d.map((x, idx) => idx === i ? { ...x, uploadedUrl: up.url, uploadedPath: up.path, uploading: false } : x));
    if (up.path) toast.success('Comprovante enviado');
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
        if (!d.amount && !d.description && !d.file && !d.uploadedPath) continue;
        let url: string | null = d.uploadedUrl || null;
        let path: string | null = d.uploadedPath || null;
        if (!path && d.file) {
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

  const exportFullPdf = async (targetReports?: ExpenseReport[]) => {
    const repsToExport = targetReports || reports;
    if (repsToExport.length === 0) {
      toast.error('Não há solicitações para exportar');
      return;
    }

    // Compute totals for the reports being exported
    let exportTotalSpent = 0, exportTotalAdvance = 0;
    repsToExport.forEach(r => {
      exportTotalAdvance += Number(r.company_advance || 0);
      exportTotalSpent += (items[r.id] || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    });
    const exportDiff = exportTotalSpent - exportTotalAdvance;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Try to add logo (preserve aspect ratio for crisp rendering)
    const LOGO_MAX_W = 32;
    const LOGO_MAX_H = 12;
    let logoH = 0;
    try {
      const logoUrl = (await import('@/assets/logo-digitale-full.png')).default;
      const { dataUrl, w, h } = await new Promise<{ dataUrl: string; w: number; h: number }>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => {
          const c = document.createElement('canvas');
          c.width = i.width; c.height = i.height;
          c.getContext('2d')?.drawImage(i, 0, 0);
          resolve({ dataUrl: c.toDataURL('image/png'), w: i.width, h: i.height });
        };
        i.onerror = reject;
        i.src = logoUrl;
      });
      const ratio = w / h;
      let drawW = LOGO_MAX_W;
      let drawH = drawW / ratio;
      if (drawH > LOGO_MAX_H) { drawH = LOGO_MAX_H; drawW = drawH * ratio; }
      doc.addImage(dataUrl, 'PNG', margin, 10, drawW, drawH, undefined, 'FAST');
      logoH = drawH;
    } catch { /* ignore */ }

    // Title block placed below the logo so nothing overlaps
    const titleY = Math.max(10 + logoH + 8, 26);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('RELATÓRIO DE REEMBOLSO DE VIAGENS', pageWidth / 2, titleY, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, titleY + 6, { align: 'center' });
    doc.setTextColor(0);

    // Collaborator box
    const boxY = titleY + 12;
    const boxH = 20;
    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, boxY, pageWidth - 2 * margin, boxH, 2, 2, 'FD');

    const colW = (pageWidth - 2 * margin) / 3;
    const col1X = margin + 3;
    const col2X = margin + colW + 3;
    const col3X = margin + 2 * colW + 3;
    const row1 = boxY + 8;
    const row2 = boxY + 15;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Colaborador:', col1X, row1);
    doc.setFont('helvetica', 'normal');
    doc.text(userName || '—', col1X + 24, row1);
    doc.setFont('helvetica', 'bold');
    doc.text('Total de solicitações:', col1X, row2);
    doc.setFont('helvetica', 'normal');
    doc.text(String(repsToExport.length), col1X + 38, row2);

    doc.setFont('helvetica', 'bold');
    doc.text('Recebido:', col2X, row1);
    doc.setFont('helvetica', 'normal');
    doc.text(formatBRL(exportTotalAdvance), col2X + 20, row1);
    doc.setFont('helvetica', 'bold');
    doc.text('Gasto:', col2X, row2);
    doc.setFont('helvetica', 'normal');
    doc.text(formatBRL(exportTotalSpent), col2X + 20, row2);

    doc.setFont('helvetica', 'bold');
    doc.text(exportDiff >= 0 ? 'A reembolsar:' : 'A devolver:', col3X, row1);
    doc.setFont('helvetica', 'normal');
    doc.text(formatBRL(Math.abs(exportDiff)), col3X + 28, row1);

    let y = boxY + boxH + 8;
    for (const rep of repsToExport) {
      const its = items[rep.id] || [];
      const total = its.reduce((s, i) => s + Number(i.amount || 0), 0);
      const adv = Number(rep.company_advance || 0);
      const d = total - adv;

      if (y > pageHeight - 60) { doc.addPage(); y = 20; }

      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
      doc.text(rep.title, margin + 2, y + 5);
      const statusLabel = STATUS_META[rep.status]?.label || rep.status;
      doc.text(statusLabel, pageWidth - margin - 2, y + 5, { align: 'right' });
      y += 9;

      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const meta: string[] = [];
      if (rep.trip_destination) meta.push(`Destino: ${rep.trip_destination}`);
      if (rep.trip_start_date) {
        const s = format(new Date(rep.trip_start_date + 'T00:00:00'), 'dd/MM/yyyy');
        const e = rep.trip_end_date ? format(new Date(rep.trip_end_date + 'T00:00:00'), 'dd/MM/yyyy') : null;
        meta.push(`Período: ${s}${e && e !== s ? ` → ${e}` : ''}`);
      }
      if (meta.length) { doc.text(meta.join('   |   '), margin, y); y += 5; }

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Categoria', 'Descrição', 'Valor (R$)']],
        body: its.map(it => [
          it.expense_date ? format(new Date(it.expense_date + 'T00:00:00'), 'dd/MM/yyyy') : '-',
          CATEGORY_META[it.category]?.label || it.category,
          it.description || '-',
          Number(it.amount || 0).toFixed(2).replace('.', ','),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [226, 232, 240], textColor: 30, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 3: { halign: 'right' } },
        margin: { left: margin, right: margin },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 3;

      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Recebido: ${formatBRL(adv)}   |   Gasto: ${formatBRL(total)}   |   ${d >= 0 ? 'A reembolsar' : 'A devolver'}: ${formatBRL(Math.abs(d))}`, pageWidth - margin, y + 2, { align: 'right' });
      y += 8;
      if (rep.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(`Obs: ${rep.notes}`, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += lines.length * 4 + 2;
      }
    }

    // Signatures
    if (y > pageHeight - 55) { doc.addPage(); y = 20; }
    y = Math.max(y + 10, pageHeight - 50);
    doc.setDrawColor(120);
    const sigColW = (pageWidth - 2 * margin) / 3;
    const sigY = y + 15;
    const labels = ['Administrativo', 'Gerência', 'Vendas'];
    labels.forEach((label, i) => {
      const x1 = margin + i * sigColW + 5;
      const x2 = margin + (i + 1) * sigColW - 5;
      doc.line(x1, sigY, x2, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label, (x1 + x2) / 2, sigY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Assinatura', (x1 + x2) / 2, sigY + 10, { align: 'center' });
    });

    const safeName = (userName || 'colaborador').replace(/[^\w\-]+/g, '_').slice(0, 40);
    doc.save(`reembolsos-${safeName}-${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('Relatório PDF gerado');
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

      {isAdminView ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={reports.length > 0 && selectedIds.size === reports.length}
              onCheckedChange={toggleSelectAll}
            />
            <Label htmlFor="select-all" className="text-sm cursor-pointer">
              Selecionar todos
            </Label>
            <span className="text-xs text-muted-foreground">
              {selectedIds.size > 0 && `${selectedIds.size} selecionado${selectedIds.size > 1 ? 's' : ''}`}
            </span>
          </div>
          <Button
            onClick={() => {
              if (selectedIds.size === 0) {
                toast.error('Selecione pelo menos um reembolso para exportar');
                return;
              }
              const selectedReports = reports.filter(r => selectedIds.has(r.id));
              exportFullPdf(selectedReports);
            }}
            className="gap-2"
            disabled={reports.length === 0}
          >
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>
      ) : canEdit && (
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
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {isAdminView && (
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedIds.has(rep.id)}
                            onCheckedChange={() => toggleSelect(rep.id)}
                          />
                        </div>
                      )}
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
                        onChange={(e) => { const f = e.target.files?.[0] || null; handleFilePick(i, f); }}
                      />
                      {d.uploading && <p className="text-[11px] text-muted-foreground mt-1">Enviando...</p>}
                      {!d.uploading && d.fileName && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {d.uploadedPath ? '✓ ' : ''}{d.fileName}
                        </p>
                      )}
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
