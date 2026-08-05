import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MapPin, Search, Loader2, Plus, Trash2, FileText, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isDevLevel } from '@/types/auth';

interface ExpenseItem {
  description: string;
  value: string;
}

interface TravelExpense {
  id: string;
  user_id: string;
  title: string | null;
  amount: number;
  start_date: string;
  end_date: string | null;
  category: string;
  description: string | null;
  items: ExpenseItem[];
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const FinanceiroRegistros: React.FC = () => {
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TravelExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const { user, userRole } = useAuth();
  
  const initialFormState = {
    title: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'viagem',
    description: '',
    user_id: user?.id || '',
    items: [{ description: '', value: '' }] as ExpenseItem[]
  };

  const [form, setForm] = useState(initialFormState);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('travel_expenses')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;

      const list = (data || []) as any[];
      const userIds = Array.from(new Set(list.map(e => e.user_id)));
      
      let profileMap = new Map<string, { full_name: string; email: string }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        profileMap = new Map((profs || []).map(p => [p.id, p]));
      }

      setExpenses(list.map(e => ({
        ...e,
        items: Array.isArray(e.items) ? e.items : [],
        user_name: profileMap.get(e.user_id)?.full_name || 'Usuário',
        user_email: profileMap.get(e.user_id)?.email || '',
      })));
    } catch (e: any) {
      toast.error('Erro ao carregar registros: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { description: '', value: '' }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  };

  const updateItem = (index: number, field: keyof ExpenseItem, val: string) => {
    const newItems = [...form.items];
    newItems[index][field] = val;
    setForm({ ...form, items: newItems });
  };

  const totalAmount = form.items.reduce((acc, item) => {
    const val = parseFloat(item.value.replace(',', '.')) || 0;
    return acc + val;
  }, 0);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setForm({
      ...initialFormState,
      user_id: user?.id || ''
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (expense: TravelExpense) => {
    setEditingExpense(expense);
    setForm({
      title: expense.title || '',
      start_date: expense.start_date,
      end_date: expense.end_date || expense.start_date,
      category: expense.category,
      description: expense.description || '',
      user_id: expense.user_id,
      items: [...expense.items]
    });
    setIsDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    if (form.items.length === 0 || !form.items.some(i => i.description && i.value)) {
      toast.error('Adicione pelo menos um item com descrição e valor');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title || null,
        amount: totalAmount,
        start_date: form.start_date,
        end_date: form.end_date,
        category: form.category,
        description: form.description || null,
        user_id: form.user_id,
        items: form.items.filter(i => i.description && i.value) as any
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('travel_expenses')
          .update(payload)
          .eq('id', editingExpense.id);
        if (error) throw error;
        toast.success('Registro atualizado');
      } else {
        const { error } = await supabase
          .from('travel_expenses')
          .insert([payload]);
        if (error) throw error;
        toast.success('Registro de viagem criado');
      }

      setIsDialogOpen(false);
      fetchExpenses();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from('travel_expenses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro excluído');
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + e.message);
    }
  };

  const exportToPDF = (expense: TravelExpense) => {
    const doc = new jsPDF();
    const logoUrl = "/lovable-uploads/4976451e-e283-4977-96a9-51a87754324c.png";

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 40, 'F');
    doc.addImage(logoUrl, 'PNG', 10, 5, 50, 25);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('RELATÓRIO DE GASTOS DE VIAGEM', 70, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 70, 28);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('DADOS DA VIAGEM', 10, 50);
    doc.line(10, 52, 200, 52);

    doc.setFontSize(10);
    doc.text(`Colaborador: ${expense.user_name || 'N/A'}`, 10, 60);
    doc.text(`E-mail: ${expense.user_email || 'N/A'}`, 10, 65);
    doc.text(`Título: ${expense.title || 'Sem título'}`, 10, 70);
    doc.text(`Período: ${format(new Date(expense.start_date + 'T00:00:00'), 'dd/MM/yyyy')} ${expense.end_date ? ' até ' + format(new Date(expense.end_date + 'T00:00:00'), 'dd/MM/yyyy') : ''}`, 10, 75);
    doc.text(`Categoria: ${expense.category.toUpperCase()}`, 10, 80);

    doc.text('ITENS E VALORES', 10, 95);
    doc.line(10, 97, 200, 97);

    const tableData = expense.items.map(item => [
      item.description,
      formatBRL(parseFloat(item.value.replace(',', '.')))
    ]);

    autoTable(doc, {
      startY: 100,
      head: [['Descrição', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0] },
      foot: [['TOTAL', formatBRL(expense.amount)]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save(`viagem_${expense.user_name}_${format(new Date(), 'ddMMyy')}.pdf`);
  };

  const filtered = expenses.filter(e => 
    (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
    e.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.items.some(item => item.description.toLowerCase().includes(search.toLowerCase()))
  );

  const canManage = isDevLevel(userRole) || userRole === 'financeiro';

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Registros de Viagens</h1>
              <p className="text-sm text-muted-foreground">Gestão administrativa e de campo.</p>
            </div>
          </div>
          <Button onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Registro
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">Listagem ({filtered.length})</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, item ou colaborador..."
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
              <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Itens / Título</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="text-xs font-medium">
                          {format(new Date(e.start_date + 'T00:00:00'), 'dd/MM/yy')}
                          {e.end_date && e.end_date !== e.start_date && (
                            <> - {format(new Date(e.end_date + 'T00:00:00'), 'dd/MM/yy')}</>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs">{e.user_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px]">
                          {e.title && <div className="font-semibold text-sm mb-1">{e.title}</div>}
                          <div className="flex flex-wrap gap-1">
                            {e.items.map((item, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground">
                                {item.description}: {formatBRL(parseFloat(item.value.replace(',', '.')))}
                              </span>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">{formatBRL(e.amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary"
                            onClick={() => exportToPDF(e)}
                            title="Exportar PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          
                          {canManage && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-amber-600"
                                onClick={() => handleOpenEdit(e)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-500">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não poderá ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteExpense(e.id)} className="bg-red-500 hover:bg-red-600">
                                      Confirmar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Editar Registro' : 'Novo Registro de Gasto'}</DialogTitle>
              <DialogDescription>Preencha os dados da viagem ou gasto administrativo.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título da Viagem</Label>
                <Input
                  id="title"
                  placeholder="Ex: Convenção 2024, Visita Filial..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Data Inicial</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">Data Final</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Detalhamento de Gastos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> Add Gasto
                  </Button>
                </div>
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="Descrição do gasto"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        placeholder="0,00"
                        value={item.value}
                        onChange={(e) => updateItem(idx, 'value', e.target.value)}
                      />
                    </div>
                    {form.items.length > 1 && (
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="font-bold">Total Calculado:</span>
                  <span className="text-lg font-bold text-primary">{formatBRL(totalAmount)}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Categoria Geral</Label>
                <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viagem">Viagem</SelectItem>
                    <SelectItem value="alimentacao">Alimentação</SelectItem>
                    <SelectItem value="transporte">Transporte</SelectItem>
                    <SelectItem value="hospedagem">Hospedagem</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveExpense} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingExpense ? 'Salvar Alterações' : 'Salvar Registro'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default FinanceiroRegistros;
