import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { hasFullAccess, isDevLevel } from '@/types/auth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Sparkles, Calendar, User, Trash2, Loader2, Rocket, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface DevelopmentUpdate {
  id: string;
  title: string;
  content: string;
  version: string | null;
  created_at: string;
  created_by: string | null;
  is_published: boolean;
}

const Updates: React.FC = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<DevelopmentUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<DevelopmentUpdate | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    version: '',
  });

  const isDev = isDevLevel(user?.role);

  useEffect(() => {
    fetchUpdates();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('development-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_updates',
        },
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('development_updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error('Error fetching updates:', error);
      toast.error('Erro ao carregar atualizações');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUpdate) {
        // Update existing
        const { error } = await supabase
          .from('development_updates')
          .update({
            title: formData.title.trim(),
            content: formData.content.trim(),
            version: formData.version.trim() || null,
          })
          .eq('id', editingUpdate.id);

        if (error) throw error;
        toast.success('Atualização editada com sucesso!');
      } else {
        // Create new
        const { error } = await supabase
          .from('development_updates')
          .insert({
            title: formData.title.trim(),
            content: formData.content.trim(),
            version: formData.version.trim() || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Atualização publicada com sucesso!');
      }

      setFormData({ title: '', content: '', version: '' });
      setEditingUpdate(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving update:', error);
      toast.error(editingUpdate ? 'Erro ao editar atualização' : 'Erro ao publicar atualização');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (update: DevelopmentUpdate) => {
    setEditingUpdate(update);
    setFormData({
      title: update.title,
      content: update.content,
      version: update.version || '',
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingUpdate(null);
      setFormData({ title: '', content: '', version: '' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atualização?')) return;

    try {
      const { error } = await supabase
        .from('development_updates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Atualização excluída');
    } catch (error) {
      console.error('Error deleting update:', error);
      toast.error('Erro ao excluir atualização');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="w-6 h-6 text-primary" />
              Atualizações do Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe as últimas novidades e melhorias do portal
            </p>
          </div>

          {isDev && (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Atualização
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingUpdate ? 'Editar Atualização' : 'Publicar Nova Atualização'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      placeholder="Ex: Nova funcionalidade de relatórios"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version">Versão (opcional)</Label>
                    <Input
                      id="version"
                      placeholder="Ex: v2.1.0"
                      value={formData.version}
                      onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Descrição *</Label>
                    <Textarea
                      id="content"
                      placeholder="Descreva as alterações realizadas..."
                      rows={5}
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {editingUpdate ? 'Salvando...' : 'Publicando...'}
                        </>
                      ) : (
                        editingUpdate ? 'Salvar' : 'Publicar'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Updates List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : updates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhuma atualização ainda</h3>
              <p className="text-muted-foreground mt-1">
                As atualizações do sistema aparecerão aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {updates.map((update, index) => (
              <Card 
                key={update.id} 
                className={index === 0 ? "border-primary/50 bg-primary/5" : ""}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {index === 0 && (
                          <Badge variant="default" className="bg-primary">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Mais Recente
                          </Badge>
                        )}
                        {update.version && (
                          <Badge variant="outline">{update.version}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{update.title}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(update.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </CardDescription>
                    </div>
                    {isDev && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handleEdit(update)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(update.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{update.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Updates;
