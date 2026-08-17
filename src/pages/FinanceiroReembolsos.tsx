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
  Wallet, Search, Loader2, ExternalLink, CheckCircle2, XCircle, Clock, BadgeDollarSign, FileDown, Trash2, Merge, Plus, FileText, Pencil,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import logoUrl from '@/assets/logo-white.png';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  const { realRole, user } = useAuth();
  const isDev = realRole === 'dev' || realRole === 'diretoria' || realRole === 'gerente' || realRole === 'financeiro';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [addItemFor, setAddItemFor] = useState<Report | null>(null);
  const [newItem, setNewItem] = useState<{ category: string; description: string; amount: string; expense_date: string; file: File | null }>({
    category: 'alimentacao', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), file: null,
  });
  const [savingItem, setSavingItem] = useState(false);

  // --- Edição administrativa de solicitações (dev, diretoria, gerência, financeiro) ---
  const [editReport, setEditReport] = useState<Report | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', trip_destination: '', trip_start_date: '', trip_end_date: '', company_advance: '', notes: '',
  });
  const [savingReport, setSavingReport] = useState(false);

  const openEditReport = (r: Report) => {
    setEditReport(r);
    setEditForm({
      title: r.title || '',
      trip_destination: r.trip_destination || '',
      trip_start_date: r.trip_start_date || '',
      trip_end_date: r.trip_end_date || '',
      company_advance: String(r.company_advance ?? ''),
      notes: r.notes || '',
    });
  };

  const saveEditReport = async () => {
    if (!editReport) return;
    if (!editForm.title.trim()) { toast.error('Informe o título da viagem'); return; }
    setSavingReport(true);
    const patch = {
      title: editForm.title.trim(),
      trip_destination: editForm.trip_destination.trim() || null,
      trip_start_date: editForm.trip_start_date || null,
      trip_end_date: editForm.trip_end_date || null,
      company_advance: parseFloat(String(editForm.company_advance).replace(',', '.')) || 0,
      notes: editForm.notes.trim() || null,
    };
    const { error } = await supabase.from('expense_reports').update(patch).eq('id', editReport.id);
    setSavingReport(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Solicitação atualizada');
    setReports(prev => prev.map(r => r.id === editReport.id ? { ...r, ...patch } as Report : r));
    setDetailReport(prev => prev && prev.id === editReport.id ? { ...prev, ...patch } as Report : prev);
    setEditReport(null);
  };

  // --- Edição de itens de despesa ---
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({ category: 'alimentacao', description: '', amount: '', expense_date: '' });

  const openEditItem = (it: Item) => {
    setEditItem(it);
    setItemForm({
      category: it.category || 'alimentacao',
      description: it.description || '',
      amount: String(it.amount ?? ''),
      expense_date: it.expense_date || '',
    });
  };

  const saveEditItem = async () => {
    if (!editItem) return;
    const patch = {
      category: itemForm.category,
      description: itemForm.description.trim() || null,
      amount: parseFloat(String(itemForm.amount).replace(',', '.')) || 0,
      expense_date: itemForm.expense_date || null,
    };
    const { error } = await supabase.from('expense_items').update(patch).eq('id', editItem.id);
    if (error) { toast.error('Erro ao salvar item: ' + error.message); return; }
    toast.success('Item atualizado');
    const reportId = editItem.report_id;
    setItems(prev => {
      const list = (prev[reportId] || []).map(i => i.id === editItem.id ? { ...i, ...patch } as Item : i);
      const total = list.reduce((s, i) => s + Number(i.amount || 0), 0);
      setReports(rs => rs.map(r => r.id === reportId ? { ...r, total_spent: total } : r));
      setDetailReport(d => d && d.id === reportId ? { ...d, total_spent: total } : d);
      return { ...prev, [reportId]: list };
    });
    setEditItem(null);
  };


  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const deleteReport = async (r: Report) => {
    const toastId = toast.loading('Excluindo reembolso...');
    try {
      const its = items[r.id] || [];
      const paths = its.map(i => i.receipt_path).filter(Boolean) as string[];
      if (paths.length) {
        await supabase.storage.from('reembolsos').remove(paths);
      }
      const { error } = await supabase.from('expense_reports').delete().eq('id', r.id);
      if (error) throw error;
      toast.success('Reembolso excluído do sistema', { id: toastId });
      setReports(prev => prev.filter(x => x.id !== r.id));
      setItems(prev => { const n = { ...prev }; delete n[r.id]; return n; });
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + (e?.message || ''), { id: toastId });
    }
  };

  const mergeSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length < 2) { toast.error('Selecione pelo menos 2 reembolsos'); return; }
    const chosen = reports.filter(r => ids.includes(r.id));
    const userIds = new Set(chosen.map(r => r.user_id));
    if (userIds.size > 1) { toast.error('Só é possível agrupar reembolsos do mesmo colaborador'); return; }
    setMerging(true);
    const toastId = toast.loading('Agrupando reembolsos...');
    try {
      // Target = mais antigo (mantém histórico)
      const target = [...chosen].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      const sources = chosen.filter(r => r.id !== target.id);
      const totalAdv = chosen.reduce((s, r) => s + Number(r.company_advance || 0), 0);
      const mergedNotes = [target.notes, ...sources.map(s => `[Agrupado de "${s.title}"]${s.notes ? ' ' + s.notes : ''}`)].filter(Boolean).join('\n');

      // Move items dos sources para o target
      const { error: upErr } = await supabase
        .from('expense_items')
        .update({ report_id: target.id })
        .in('report_id', sources.map(s => s.id));
      if (upErr) throw upErr;

      // Atualiza target: soma adiantados + notas
      const { error: rErr } = await supabase
        .from('expense_reports')
        .update({ company_advance: totalAdv, notes: mergedNotes })
        .eq('id', target.id);
      if (rErr) throw rErr;

      // Remove sources (sem itens agora)
      const { error: dErr } = await supabase
        .from('expense_reports')
        .delete()
        .in('id', sources.map(s => s.id));
      if (dErr) throw dErr;

      toast.success(`${sources.length + 1} reembolsos agrupados em "${target.title}"`, { id: toastId });
      setSelected(new Set());
      await fetchAll();
    } catch (e: any) {
      toast.error('Erro ao agrupar: ' + (e?.message || ''), { id: toastId });
    } finally {
      setMerging(false);
    }
  };

  const openAddItem = (r: Report) => {
    setNewItem({ category: 'alimentacao', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), file: null });
    setAddItemFor(r);
  };

  const submitAddItem = async () => {
    if (!addItemFor) return;
    const amt = parseFloat(newItem.amount.replace(',', '.')) || 0;
    if (amt <= 0) { toast.error('Informe um valor válido'); return; }
    setSavingItem(true);
    try {
      let receipt_path: string | null = null;
      let receipt_url: string | null = null;
      if (newItem.file) {
        const ext = newItem.file.name.split('.').pop() || 'bin';
        receipt_path = `${addItemFor.user_id}/${addItemFor.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('reembolsos').upload(receipt_path, newItem.file, { contentType: newItem.file.type || undefined });
        if (upErr) throw upErr;
        const { data } = await supabase.storage.from('reembolsos').createSignedUrl(receipt_path, 60 * 60 * 24 * 365);
        receipt_url = data?.signedUrl || null;
      }
      const { error } = await supabase.from('expense_items').insert({
        report_id: addItemFor.id,
        category: newItem.category,
        description: newItem.description || null,
        amount: amt,
        expense_date: newItem.expense_date,
        receipt_path,
        receipt_url,
      });
      if (error) throw error;
      toast.success('Comprovante adicionado');
      setAddItemFor(null);
      await fetchAll();
    } catch (e: any) {
      toast.error('Erro ao adicionar: ' + (e?.message || ''));
    } finally {
      setSavingItem(false);
    }
  };


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

  const exportReportPdf = async (report: Report, includeReceipts: boolean = true) => {
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
        page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 18, color: rgb(0.94, 0.94, 0.94) });
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
      if (includeReceipts) {
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
      const type = includeReceipts ? 'completo' : 'simplificado';
      a.download = `reembolso_${type}_${safe}_${report.id.slice(0, 8)}.pdf`;
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
    const acc = { pendente: 0, aprovado: 0, rejeitado: 0, pago: 0, totalSpent: 0, totalAdvance: 0, toReimburse: 0, toReturn: 0 };
    reports.forEach(r => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      const spent = Number(r.total_spent || 0);
      const adv = Number(r.company_advance || 0);
      acc.totalSpent += spent;
      acc.totalAdvance += adv;
      const d = spent - adv;
      if (d >= 0) acc.toReimburse += d;
      else acc.toReturn += -d;
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
              <p className="text-xs text-muted-foreground uppercase">Adiantado</p>
              <p className="text-lg font-bold mt-1">{formatBRL(kpis.totalAdvance)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">Gasto</p>
              <p className="text-lg font-bold mt-1">{formatBRL(kpis.totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">A Reembolsar</p>
              <p className="text-lg font-bold mt-1 text-emerald-600">{formatBRL(kpis.toReimburse)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase">A Devolver</p>
              <p className="text-lg font-bold mt-1 text-amber-600">{formatBRL(kpis.toReturn)}</p>
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
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Solicitações ({filtered.length})</span>
              {isDev && selected.size >= 2 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="default" disabled={merging}>
                      <Merge className="w-4 h-4 mr-1" /> Agrupar {selected.size} reembolsos
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Agrupar reembolsos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Os itens e adiantamentos serão consolidados no reembolso mais antigo selecionado. Os demais serão removidos. Só é permitido agrupar reembolsos do mesmo colaborador.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={mergeSelected}>Agrupar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardTitle>
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
                      {isDev && <TableHead className="w-8"></TableHead>}
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Viagem</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Adiantado</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
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
                          {isDev && (
                            <TableCell onClick={(e) => e.stopPropagation()} className="w-8">
                              <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                            </TableCell>
                          )}
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
                            {diff >= 0 ? '+' : '−'} {formatBRL(Math.abs(diff))}
                            <p className="text-[10px] font-normal text-muted-foreground">{diff >= 0 ? 'a reembolsar' : 'a devolver'}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>
                              <Icon className="w-3 h-3 mr-1" />
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Select onValueChange={(v) => exportReportPdf(r, v === 'full')}>
                                <SelectTrigger className="w-[40px] h-8 p-0 border-none bg-transparent hover:bg-accent focus:ring-0 focus:ring-offset-0">
                                  <FileDown className="w-4 h-4 mx-auto" />
                                </SelectTrigger>
                                <SelectContent align="end">
                                  <SelectItem value="full">Relatório Completo (com recibos)</SelectItem>
                                  <SelectItem value="simple">Relatório Simplificado (sem recibos)</SelectItem>
                                </SelectContent>
                              </Select>
                              {isDev && (
                                <Button size="sm" variant="ghost" className="h-8 px-2" title="Editar solicitação" onClick={() => openEditReport(r)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {isDev && (
                                <Button size="sm" variant="ghost" className="h-8 px-2" title="Adicionar comprovante" onClick={() => openAddItem(r)}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}

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
                              {isDev && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700" title="Excluir do sistema">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir reembolso?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação remove o reembolso <strong>{r.title}</strong> de {r.user_name}, todos os itens e comprovantes, permanentemente do sistema. Não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteReport(r)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
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
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(items[detailReport.id] || []).map(it => (
                          <TableRow key={it.id}>
                            <TableCell className="text-xs">
                              {it.expense_date ? format(new Date(it.expense_date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                            </TableCell>
                            <TableCell className="text-xs capitalize">{it.category}</TableCell>
                            <TableCell className="text-xs">{it.description || '—'}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatBRL(Number(it.amount || 0))}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {it.receipt_url && (
                                  <a href={it.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-primary hover:bg-accent">
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                {isDev && (
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Editar item" onClick={() => openEditItem(it)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {isDev && (

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Deseja remover este comprovante de {formatBRL(it.amount)}?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-600"
                                          onClick={async () => {
                                            try {
                                              if (it.receipt_path) await supabase.storage.from('reembolsos').remove([it.receipt_path]);
                                              const { error } = await supabase.from('expense_items').delete().eq('id', it.id);
                                              if (error) throw error;
                                              
                                              // Atualiza o estado local do relatório detalhado para refletir a remoção imediata
                                              if (detailReport) {
                                                const currentItems = items[detailReport.id] || [];
                                                const updatedItems = currentItems.filter(x => x.id !== it.id);
                                                
                                                setItems(prev => ({
                                                  ...prev,
                                                  [detailReport.id]: updatedItems
                                                }));
                                                
                                                // Também atualiza o total_spent no relatório para manter a UI consistente
                                                const newTotal = updatedItems.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
                                                setReports(prev => prev.map(r => 
                                                  r.id === detailReport.id ? { ...r, total_spent: newTotal } : r
                                                ));
                                                setDetailReport({ ...detailReport, total_spent: newTotal });
                                              }

                                              toast.success('Item removido');
                                              await fetchAll();
                                            } catch (err: any) {
                                              toast.error('Erro ao remover: ' + err.message);
                                            }
                                          }}
                                        >
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Select onValueChange={(v) => exportReportPdf(detailReport, v === 'full')}>
                    <SelectTrigger className="w-auto h-9 px-3 gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <FileDown className="w-4 h-4" />
                      <span className="text-sm font-medium">Exportar PDF</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Completo (com recibos)</SelectItem>
                      <SelectItem value="simple">Simplificado (sem recibos)</SelectItem>
                    </SelectContent>
                  </Select>
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

      {/* Add item dialog (dev only) */}
      <Dialog open={!!addItemFor} onOpenChange={(o) => { if (!o) setAddItemFor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar comprovante</DialogTitle>
            <DialogDescription>{addItemFor?.title} · {addItemFor?.user_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <Select value={newItem.category} onValueChange={(v) => setNewItem(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alimentacao">Alimentação</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="hospedagem">Hospedagem</SelectItem>
                  <SelectItem value="combustivel">Combustível</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={newItem.description} onChange={(e) => setNewItem(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={newItem.amount} onChange={(e) => setNewItem(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={newItem.expense_date} onChange={(e) => setNewItem(p => ({ ...p, expense_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Comprovante (imagem/PDF)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setNewItem(p => ({ ...p, file: e.target.files?.[0] || null }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddItemFor(null)}>Cancelar</Button>
              <Button onClick={submitAddItem} disabled={savingItem}>
                {savingItem && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar solicitação (admin) */}
      <Dialog open={!!editReport} onOpenChange={(o) => { if (!o) setEditReport(null); }}>
        <DialogContent
          className="max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Editar solicitação de reembolso</DialogTitle>
            <DialogDescription>
              Ajuste os dados da viagem, inclusive o valor adiantado pela empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título da viagem *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Destino</Label>
                <Input value={editForm.trip_destination} onChange={(e) => setEditForm(p => ({ ...p, trip_destination: e.target.value }))} />
              </div>
              <div>
                <Label>Valor adiantado pela empresa (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={editForm.company_advance}
                  onChange={(e) => setEditForm(p => ({ ...p, company_advance: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de início</Label>
                <Input type="date" value={editForm.trip_start_date} onChange={(e) => setEditForm(p => ({ ...p, trip_start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Data de término</Label>
                <Input type="date" value={editForm.trip_end_date} onChange={(e) => setEditForm(p => ({ ...p, trip_end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditReport(null)} disabled={savingReport}>Cancelar</Button>
              <Button onClick={saveEditReport} disabled={savingReport}>
                {savingReport && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar item de despesa (admin) */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent
          className="max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Editar item de despesa</DialogTitle>
            <DialogDescription>Atualize categoria, descrição, valor ou data do gasto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <Select value={itemForm.category} onValueChange={(v) => setItemForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alimentacao">Alimentação</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="hospedagem">Hospedagem</SelectItem>
                  <SelectItem value="combustivel">Combustível</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={itemForm.description} onChange={(e) => setItemForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" value={itemForm.amount} onChange={(e) => setItemForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={itemForm.expense_date} onChange={(e) => setItemForm(p => ({ ...p, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
              <Button onClick={saveEditItem}>Salvar item</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>

  );
};

export default FinanceiroReembolsos;
