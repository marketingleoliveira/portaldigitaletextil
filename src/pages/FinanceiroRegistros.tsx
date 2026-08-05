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
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Search, Loader2, Plus, Trash2, Calendar, Wallet, ListPlus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  
  const [newExpense, setNewExpense] = useState({
    title: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'viagem',
    description: '',
    user_id: user?.id || '',
    items: [{ description: '', value: '' }] as ExpenseItem[]
  });

  const [profiles, setProfiles] = useState<{ id: string, full_name: string }[]>([]);

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

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
    if (data) setProfiles(data);
  };

  useEffect(() => {
    fetchExpenses();
    fetchProfiles();
  }, []);

  const addItem = () => {
    setNewExpense({
      ...newExpense,
      items: [...newExpense.items, { description: '', value: '' }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...newExpense.items];
    newItems.splice(index, 1);
    setNewExpense({ ...newExpense, items: newItems });
  };

  const updateItem = (index: number, field: keyof ExpenseItem, val: string) => {
    const newItems = [...newExpense.items];
    newItems[index][field] = val;
    setNewExpense({ ...newExpense, items: newItems });
  };

  const totalAmount = newExpense.items.reduce((acc, item) => {
    const val = parseFloat(item.value.replace(',', '.')) || 0;
    return acc + val;
  }, 0);

  const handleAddExpense = async () => {
    if (newExpense.items.length === 0 || !newExpense.items.some(i => i.description && i.value)) {
      toast.error('Adicione pelo menos um item com descrição e valor');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('travel_expenses').insert([{
        title: newExpense.title || null,
        amount: totalAmount,
        start_date: newExpense.start_date,
        end_date: newExpense.end_date,
        category: newExpense.category,
        description: newExpense.description || null,
        user_id: newExpense.user_id,
        items: newExpense.items.filter(i => i.description && i.value) as any
      }]);

      if (error) throw error;

      toast.success('Registro de viagem criado com sucesso');
      setIsAddOpen(false);
      setNewExpense({
        title: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
        category: 'viagem',
        description: '',
        user_id: user?.id || '',
        items: [{ description: '', value: '' }]
      });
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

  const filtered = expenses.filter(e => 
    (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
    e.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.items.some(item => item.description.toLowerCase().includes(search.toLowerCase()))
  );

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
              <p className="text-sm text-muted-foreground">Gastos de viagens com detalhamento por item.</p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
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
                    <TableHead>Categoria</TableHead>
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
                      <TableCell className="capitalize text-xs">{e.category}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação removerá permanentemente este registro de viagem.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteExpense(e.id)} className="bg-red-500 hover:bg-red-600">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Registro de Gasto</DialogTitle>
              <DialogDescription>Detalhe os gastos da viagem. O total será calculado automaticamente.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="user">Colaborador</Label>
                <Select value={newExpense.user_id} onValueChange={(val) => setNewExpense({ ...newExpense, user_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Data Inicial</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={newExpense.start_date}
                    onChange={(e) => setNewExpense({ ...newExpense, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">Data Final</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={newExpense.end_date}
                    onChange={(e) => setNewExpense({ ...newExpense, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="title">Título da Viagem (Opcional)</Label>
                <Input
                  id="title"
                  placeholder="Ex: Convenção 2024, Visita Filial..."
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Detalhamento de Gastos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> Add Gasto
                  </Button>
                </div>
                {newExpense.items.map((item, idx) => (
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
                    {newExpense.items.length > 1 && (
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
                <Select value={newExpense.category} onValueChange={(val) => setNewExpense({ ...newExpense, category: val })}>
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
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddExpense} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Registro
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default FinanceiroRegistros;