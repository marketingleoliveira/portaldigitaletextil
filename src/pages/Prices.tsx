import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hasFullAccess, hasAllRegionsAccess } from '@/types/auth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Upload, 
  Download, 
  Eye, 
  Trash2, 
  FileSpreadsheet, 
  Plus,
  Loader2,
  Search,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import SpreadsheetPreview from '@/components/SpreadsheetPreview';
import SpreadsheetMiniPreview from '@/components/SpreadsheetMiniPreview';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const REGIONS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF'];

interface PriceFile {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_size: number | null;
  region: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const Prices: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role ? hasFullAccess(user.role) : false;
  
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<PriceFile | null>(null);
  
  // Search, filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'region'>('date');
  
  // Form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [fileRegion, setFileRegion] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);

  // Check if user can see all regions
  const userRegion = user?.profile?.region;
  const canSeeAllRegions = hasFullAccess(user?.role) || 
                           user?.role === 'gerente' || 
                           hasAllRegionsAccess(userRegion);

  // Fetch price files
  const { data: priceFiles = [], isLoading } = useQuery({
    queryKey: ['price-files'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_files')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PriceFile[];
    }
  });

  // Filter files by region for non-admin users and apply search/filter/sort
  const filteredFiles = useMemo(() => {
    let files = canSeeAllRegions 
      ? priceFiles 
      : priceFiles.filter(f => !f.region || f.region === userRegion);
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      files = files.filter(f => 
        f.name.toLowerCase().includes(search) ||
        (f.description && f.description.toLowerCase().includes(search))
      );
    }
    
    // Apply region filter
    if (filterRegion !== 'all') {
      files = files.filter(f => f.region === filterRegion || (!f.region && filterRegion === 'todas'));
    }
    
    // Apply sorting
    files = [...files].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR');
        case 'region':
          const regionA = a.region || 'ZZZ'; // Put "Todas" at the end
          const regionB = b.region || 'ZZZ';
          return regionA.localeCompare(regionB, 'pt-BR');
        case 'date':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
    
    return files;
  }, [priceFiles, canSeeAllRegions, userRegion, searchTerm, filterRegion, sortBy]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, name, description, region }: { 
      file: File; 
      name: string; 
      description: string; 
      region: string | null;
    }) => {
      const fileExt = file.name.split('.').pop();
      const filePath = `${Date.now()}-${name.replace(/\s+/g, '-')}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('price-files')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('price-files')
        .getPublicUrl(filePath);
      
      const { error: insertError } = await supabase
        .from('price_files')
        .insert({
          name,
          description: description || null,
          file_url: urlData.publicUrl,
          file_size: file.size,
          region: region === 'all' ? null : region,
          created_by: user?.id
        });
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-files'] });
      toast.success('Arquivo enviado com sucesso!');
      resetForm();
      setIsUploadDialogOpen(false);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar arquivo');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_files')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-files'] });
      toast.success('Arquivo excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Erro ao excluir arquivo');
    }
  });

  const resetForm = () => {
    setUploadFile(null);
    setFileName('');
    setFileDescription('');
    setFileRegion('all');
  };

  const handleUpload = () => {
    if (!uploadFile || !fileName) {
      toast.error('Selecione um arquivo e informe o nome');
      return;
    }
    
    // Validate file type
    const ext = uploadFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      toast.error('Apenas arquivos Excel (.xlsx, .xls) são permitidos');
      return;
    }
    
    setIsUploading(true);
    uploadMutation.mutate({
      file: uploadFile,
      name: fileName,
      description: fileDescription,
      region: fileRegion === 'all' ? null : fileRegion
    }, {
      onSettled: () => setIsUploading(false)
    });
  };

  const handlePreview = (file: PriceFile) => {
    setPreviewUrl(file.file_url);
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  const handleDownload = (file: PriceFile) => {
    window.open(file.file_url, '_blank');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRegionLabel = (region: string | null) => {
    if (!region) return 'Todas';
    return region;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Tabela de Preços
            </h1>
            <p className="text-muted-foreground">
              {canSeeAllRegions
                ? 'Visualize todas as planilhas de preços'
                : `Planilhas de preços da sua região (${userRegion || 'Todas'})`}
            </p>
          </div>
          
          {canManage && (
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setIsUploadDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Planilha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Planilha Excel</DialogTitle>
                  <DialogDescription>
                    Faça upload de uma planilha de preços em formato Excel (.xlsx, .xls)
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Arquivo Excel</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          if (!fileName) {
                            setFileName(file.name.replace(/\.[^/.]+$/, ''));
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas arquivos Excel (.xlsx, .xls)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="Nome da planilha"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                      placeholder="Descrição da planilha"
                      rows={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="region">Região</Label>
                    <Select value={fileRegion} onValueChange={setFileRegion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a região" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as regiões</SelectItem>
                        {REGIONS.map(region => (
                          <SelectItem key={region} value={region}>{region}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpload} disabled={isUploading || !uploadFile}>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {canSeeAllRegions && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filtrar região" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as regiões</SelectItem>
                  <SelectItem value="todas">Sem região específica</SelectItem>
                  {REGIONS.map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: 'name' | 'date' | 'region') => setSortBy(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Mais recentes</SelectItem>
                <SelectItem value="name">Nome (A-Z)</SelectItem>
                <SelectItem value="region">Região</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Spreadsheet Preview */}
        {selectedFile && previewUrl && (
          <SpreadsheetPreview
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
            fileUrl={previewUrl}
            fileName={selectedFile.name}
          />
        )}

        {/* Files Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">
                {searchTerm || filterRegion !== 'all' 
                  ? 'Nenhuma planilha encontrada' 
                  : 'Nenhuma planilha disponível'}
              </p>
              <p className="text-sm">
                {searchTerm || filterRegion !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : canManage 
                    ? 'Clique em "Nova Planilha" para adicionar' 
                    : 'Não há planilhas disponíveis para sua região'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <Card 
                key={file.id} 
                className="group hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50"
                onClick={() => handlePreview(file)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate" title={file.name}>
                        {file.name}
                      </CardTitle>
                      {file.description && (
                        <CardDescription className="text-xs mt-1 line-clamp-2">
                          {file.description}
                        </CardDescription>
                      )}
                    </div>
                    <FileSpreadsheet className="w-8 h-8 text-green-600 flex-shrink-0 ml-2" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Mini Preview */}
                  <div className="mb-3">
                    <SpreadsheetMiniPreview fileUrl={file.file_url} />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <Badge variant="outline" className="text-xs">
                      {getRegionLabel(file.region)}
                    </Badge>
                    <span>{formatFileSize(file.file_size)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Atualizado em {format(new Date(file.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePreview(file)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(file.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Prices;
