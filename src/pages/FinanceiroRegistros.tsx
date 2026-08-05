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
import { MapPin, Search, Loader2, Plus, Trash2, FileText, Calendar, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface TravelExpense {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  expense_date: string;
  category: string;
  description: string | null;
  receipt_url: string | null;
  receipt_path: string | null;
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
  const { user, realRole } = useAuth();
  
  const [newExpense, setNewExpense] = useState({
    title: '',
    amount: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'viagem',
    description: '',
    user_id: user?.id || '',
    file: null as File | null
  });

  const [profiles, setProfiles] = useState<{ id: string, full_name: string }[]>([]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('travel_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw error;

      const list = data as TravelExpense[];
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

  const handleAddExpense = async () => {
    const amt = parseFloat(newExpense.amount.replace(',', '.')) || 0;
    if (!newExpense.title || amt <= 0) {
      toast.error('Preencha o título e um valor válido');
      return;
    }

    setSaving(true);
    try {
      let receipt_path: string | null = null;
      let receipt_url: string | null = null;

      if (newExpense.file) {
        const ext = newExpense.file.name.split('.').pop();
        receipt_path = `travel/${newExpense.user_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('reembolsos').upload(receipt_path, newExpense.file);
        if (upErr) throw upErr;
        
        const { data } = await supabase.storage.from('reembolsos').createSignedUrl(receipt_path, 60 * 60 * 24 * 365);
        receipt_url = data?.signedUrl || null;
      }

      const { error } = await supabase.from('travel_expenses').insert({
        title: newExpense.title,
        amount: amt,
        expense_date: newExpense.expense_date,
        category: newExpense.category,
        description: newExpense.description || null,
        user_id: newExpense.user_id,
        receipt_path,
        receipt_url
      });

      if (error) throw error;

      toast.success('Registro de viagem criado com sucesso');
      setIsAddOpen(false);
      setNewExpense({
        title: '',
        amount: '',
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        category: 'viagem',
        description: '',
        user_id: user?.id || '',
        file: null
      });
      fetchExpenses();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string, path: string | null) => {
    try {
      if (path) {
        await supabase.storage.from('reembolsos').remove([path]);
      }
      const { error } = await supabase.from('travel_expenses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro excluído');
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + e.message);
    }
  };

  const filtered = expenses.filter(e => 
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.user_name?.toLowerCase().includes(search.toLowerCase())
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
              <p className="text-sm text-muted-foreground">Gastos de viagens não vinculados a reembolsos.</p>
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
                placeholder="Buscar por título ou colaborador..."
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
                    <TableHead>Data</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{format(new Date(e.expense_date + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="font-medium">{e.user_name}</div>
                        <div className="text-xs text-muted-foreground">{e.user_email}</div>
                      </TableCell>
                      <TableCell>{e.title}</TableCell>
                      <TableCell className="font-semibold text-primary">{formatBRL(e.amount)}</TableCell>
                      <TableCell className="capitalize">{e.category}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {e.receipt_url && (
                            <Button variant="ghost" size="sm" asChild title="Ver Comprovante">
                              <a href={e.receipt_url} target="_blank" rel="noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
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
                                  Esta ação removerá permanentemente o registro de <strong>{e.title}</strong>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteExpense(e.id, e.receipt_path)} className="bg-red-500 hover:bg-red-600">
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Registro de Gasto</DialogTitle>
              <DialogDescription>Crie um registro de gasto de viagem com poder total.</DialogDescription>
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
              <div className="grid gap-2">
                <Label htmlFor="title">Título do Gasto</Label>
                <Input
                  id="title"
                  placeholder="Ex: Almoço Cliente, Combustível, Hotel..."
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    placeholder="0,00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newExpense.expense_date}
                    onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
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
              <div className="grid gap-2">
                <Label htmlFor="desc">Descrição / Notas</Label>
                <Textarea
                  id="desc"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="file">Comprovante (Opcional)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setNewExpense({ ...newExpense, file: e.target.files?.[0] || null })}
                />
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
