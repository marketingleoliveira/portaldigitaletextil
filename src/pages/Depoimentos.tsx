import React, { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTestimonials, TestimonialSchedule } from '@/hooks/useTestimonials';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Clock, Building2, Phone, FileText, Upload, Check, Trash2, ChevronLeft, ChevronRight, Loader2, Paperclip, Pencil, Link2, ExternalLink } from 'lucide-react';
import { isDevLevel } from '@/types/auth';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  realizado: { label: 'Realizado', variant: 'secondary' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

interface TestimonialForm {
  company_name: string;
  contact_name: string;
  contact_phone: string;
  scheduled_date: string;
  scheduled_time: string;
  notes: string;
  orientation_file_url: string;
  orientation_file_name: string;
  meeting_link: string;
  status: string;
}

const emptyForm: TestimonialForm = {
  company_name: '',
  contact_name: '',
  contact_phone: '',
  scheduled_date: '',
  scheduled_time: '09:00',
  notes: '',
  orientation_file_url: '',
  orientation_file_name: '',
  meeting_link: '',
  status: 'pendente',
};

const Depoimentos: React.FC = () => {
  const { user } = useAuth();
  const { testimonials, isLoading, createTestimonial, updateTestimonial, deleteTestimonial } = useTestimonials();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailDialog, setDetailDialog] = useState<TestimonialSchedule | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<TestimonialForm>({ ...emptyForm });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const testimonialsByDate = useMemo(() => {
    const map: Record<string, TestimonialSchedule[]> = {};
    testimonials.forEach((t) => {
      const dateKey = format(parseISO(t.scheduled_date), 'yyyy-MM-dd');
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(t);
    });
    return map;
  }, [testimonials]);

  const selectedDayTestimonials = selectedDate
    ? testimonials.filter((t) => isSameDay(parseISO(t.scheduled_date), selectedDate))
    : [];

  const todayTestimonials = testimonials.filter(
    (t) => isSameDay(parseISO(t.scheduled_date), new Date()) && t.status !== 'realizado' && t.status !== 'cancelado'
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('testimonial-files').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('testimonial-files').getPublicUrl(path);
      setForm((prev) => ({ ...prev, orientation_file_url: urlData.publicUrl, orientation_file_name: file.name }));
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.company_name || !form.scheduled_date) return;
    const dateTime = `${form.scheduled_date}T${form.scheduled_time}:00`;

    if (editingId) {
      updateTestimonial.mutate({
        id: editingId,
        company_name: form.company_name,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        scheduled_date: new Date(dateTime).toISOString(),
        notes: form.notes || null,
        orientation_file_url: form.orientation_file_url || null,
        orientation_file_name: form.orientation_file_name || null,
        meeting_link: form.meeting_link || null,
        status: form.status,
      });
    } else {
      createTestimonial.mutate({
        company_name: form.company_name,
        contact_name: form.contact_name || undefined,
        contact_phone: form.contact_phone || undefined,
        scheduled_date: new Date(dateTime).toISOString(),
        notes: form.notes || undefined,
        orientation_file_url: form.orientation_file_url || undefined,
        orientation_file_name: form.orientation_file_name || undefined,
        meeting_link: form.meeting_link || undefined,
      });
    }
    closeFormDialog();
  };

  const closeFormDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const openEdit = (t: TestimonialSchedule) => {
    const date = parseISO(t.scheduled_date);
    setForm({
      company_name: t.company_name,
      contact_name: t.contact_name || '',
      contact_phone: t.contact_phone || '',
      scheduled_date: format(date, 'yyyy-MM-dd'),
      scheduled_time: format(date, 'HH:mm'),
      notes: t.notes || '',
      orientation_file_url: t.orientation_file_url || '',
      orientation_file_name: t.orientation_file_name || '',
      meeting_link: t.meeting_link || '',
      status: t.status,
    });
    setEditingId(t.id);
    setDetailDialog(null);
    setDialogOpen(true);
  };

  const handleMarkComplete = (t: TestimonialSchedule) => {
    updateTestimonial.mutate({ id: t.id, status: 'realizado', completed_at: new Date().toISOString() });
    setDetailDialog(null);
  };

  const openNewWithDate = (date: Date) => {
    setForm({ ...emptyForm, scheduled_date: format(date, 'yyyy-MM-dd') });
    setEditingId(null);
    setDialogOpen(true);
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Depoimentos</h1>
            <p className="text-muted-foreground">Agende e gerencie gravações de depoimentos</p>
          </div>
          <Button onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Agendar Depoimento
          </Button>
        </div>

        {/* Today's pending */}
        {todayTestimonials.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                Depoimentos Pendentes Hoje ({todayTestimonials.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayTestimonials.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setDetailDialog(t)}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{t.company_name}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(t.scheduled_date), 'HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.meeting_link && <Link2 className="w-3 h-3 text-primary" />}
                      <Badge variant={STATUS_MAP[t.status]?.variant || 'outline'}>{STATUS_MAP[t.status]?.label || t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {weekDays.map((d) => (
                  <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
                {calendarDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayItems = testimonialsByDate[dateKey] || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={dateKey}
                      className={`bg-card min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-accent/30 ${!isCurrentMonth ? 'opacity-40' : ''} ${isSelected ? 'ring-2 ring-primary ring-inset' : ''} ${isToday(day) ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedDate(day)}
                      onDoubleClick={() => openNewWithDate(day)}
                    >
                      <span className={`text-xs font-medium ${isToday(day) ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayItems.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${
                              t.status === 'realizado' ? 'bg-muted text-muted-foreground line-through' :
                              t.status === 'cancelado' ? 'bg-destructive/10 text-destructive line-through' :
                              'bg-primary/10 text-primary'
                            }`}
                            onClick={(e) => { e.stopPropagation(); setDetailDialog(t); }}
                          >
                            {format(parseISO(t.scheduled_date), 'HH:mm')} {t.company_name}
                          </div>
                        ))}
                        {dayItems.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayItems.length - 3} mais</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Side panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="space-y-3">
                  {selectedDayTestimonials.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-3">Nenhum depoimento agendado</p>
                      <Button variant="outline" size="sm" onClick={() => openNewWithDate(selectedDate)}>
                        <Plus className="w-3 h-3 mr-1" />
                        Agendar
                      </Button>
                    </div>
                  ) : (
                    selectedDayTestimonials.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setDetailDialog(t)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{t.company_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(t.scheduled_date), 'HH:mm')}
                            </p>
                            {t.contact_name && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t.contact_name}</p>
                            )}
                          </div>
                          <Badge variant={STATUS_MAP[t.status]?.variant || 'outline'} className="text-[10px] shrink-0">
                            {STATUS_MAP[t.status]?.label || t.status}
                          </Badge>
                        </div>
                        {t.meeting_link && (
                          <p className="text-[10px] text-primary flex items-center gap-1 mt-2">
                            <Link2 className="w-3 h-3" />
                            Link da reunião
                          </p>
                        )}
                        {t.orientation_file_name && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Paperclip className="w-3 h-3" />
                            {t.orientation_file_name}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Clique em um dia no calendário para ver os depoimentos agendados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeFormDialog(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Depoimento' : 'Agendar Depoimento'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Nome da empresa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Horário *</Label>
                  <Input type="time" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Nome do contato" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" />
                  Link da Reunião
                </Label>
                <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." />
              </div>
              {editingId && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Informações adicionais..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Arquivo de Orientação</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <label className="cursor-pointer">
                      {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                      {form.orientation_file_name || 'Selecionar arquivo'}
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeFormDialog}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!form.company_name || !form.scheduled_date || createTestimonial.isPending || updateTestimonial.isPending}>
                {(createTestimonial.isPending || updateTestimonial.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editingId ? 'Salvar' : 'Agendar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {detailDialog?.company_name}
              </DialogTitle>
            </DialogHeader>
            {detailDialog && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_MAP[detailDialog.status]?.variant || 'outline'}>
                    {STATUS_MAP[detailDialog.status]?.label || detailDialog.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(detailDialog.scheduled_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {detailDialog.contact_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Contato:</span>
                    <span>{detailDialog.contact_name}</span>
                  </div>
                )}
                {detailDialog.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{detailDialog.contact_phone}</span>
                  </div>
                )}
                {detailDialog.meeting_link && (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    <a href={detailDialog.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      Link da Reunião
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {detailDialog.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Observações:</p>
                    <p className="bg-muted p-3 rounded-lg">{detailDialog.notes}</p>
                  </div>
                )}
                {detailDialog.orientation_file_url && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <a href={detailDialog.orientation_file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      {detailDialog.orientation_file_name || 'Arquivo de orientação'}
                    </a>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailDialog)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  {detailDialog.status !== 'realizado' && (
                    <Button size="sm" onClick={() => handleMarkComplete(detailDialog)}>
                      <Check className="w-4 h-4 mr-1" />
                      Marcar como Realizado
                    </Button>
                  )}
                  {isDevLevel(user?.role) && (
                    <Button variant="destructive" size="sm" onClick={() => { deleteTestimonial.mutate(detailDialog.id); setDetailDialog(null); }}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Depoimentos;
