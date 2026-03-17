import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { FileItem, AppRole } from '@/types/auth';
import { 
  FileText, Download, Search, Loader2, FolderOpen, Eye, X,
  FileImage, FileVideo, FileAudio, FileSpreadsheet, FileType, File, Globe, ExternalLink,
  ChevronDown, ChevronRight, AlertTriangle, List
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessLog } from '@/hooks/useAccessLog';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CURRENT_SUPABASE_HOST = 'ddgbqeaqksiamnnzioyv.supabase.co';

const isFileBroken = (fileUrl: string): boolean => {
  if (!fileUrl) return false;
  const isSupabaseUrl = fileUrl.includes('.supabase.co/storage/');
  if (!isSupabaseUrl) return false;
  return !fileUrl.includes(CURRENT_SUPABASE_HOST);
};

const Downloads: React.FC = () => {
  const { user } = useAuth();
  const { logDownload } = useAccessLog();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<{id: string, name: string, category_id: string}[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showBrokenList, setShowBrokenList] = useState(false);

  const handleDownload = async (file: FileItem) => {
    try {
      await logDownload('file', file.id);
      window.open(file.file_url, '_blank');
      toast({
        title: file.is_external_link ? 'Link aberto' : 'Download iniciado',
        description: file.is_external_link ? `Acessando ${file.name}` : `Baixando ${file.name}`,
      });
    } catch (error) {
      console.error('Error during download:', error);
    }
  };

  const handleAccessLink = async (file: FileItem) => {
    try {
      await logDownload('link', file.id);
      window.open(file.file_url, '_blank');
      toast({
        title: 'Link aberto',
        description: `Acessando ${file.name}`,
      });
    } catch (error) {
      console.error('Error accessing link:', error);
    }
  };

  const handlePreview = (file: FileItem) => {
    setPreviewFile(file);
  };

  useEffect(() => {
    fetchFiles();

    // Subscribe to realtime updates on files table
    const channel = supabase
      .channel('files-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
        },
        () => {
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFiles = async () => {
    try {
      // Fetch files
      const { data: filesData, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch subcategories
      const { data: subcategoriesData } = await supabase
        .from('subcategories')
        .select('id, name, category_id');
      
      setSubcategories(subcategoriesData || []);

      // Fetch categories to map category_id to category name
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name');
      
      const categoryMap = new Map(categoriesData?.map(c => [c.id, c.name]) || []);

      // Add category name to subcategories for easier lookup
      const subcatsWithCategoryName = (subcategoriesData || []).map(s => ({
        ...s,
        categoryName: categoryMap.get(s.category_id) || ''
      }));

      setSubcategories(subcatsWithCategoryName as any);

      const filesWithVisibility = await Promise.all(
        (filesData || []).map(async (file) => {
          const { data: visibility } = await supabase
            .from('file_visibility')
            .select('visible_to_role')
            .eq('file_id', file.id);
          
          return {
            ...file,
            visibility: visibility?.map(v => v.visible_to_role as AppRole) || [],
          };
        })
      );

      setFiles(filesWithVisibility);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(files.map(f => f.category).filter(Boolean))] as string[];

  // Get subcategories for a specific category
  const getSubcategoriesForCategory = (categoryName: string) => {
    return (subcategories as any[]).filter(s => s.categoryName === categoryName);
  };

  // Check if a category has subcategories
  const categoryHasSubcategories = (categoryName: string) => {
    return getSubcategoriesForCategory(categoryName).length > 0;
  };

  const handleCategoryClick = (category: string) => {
    if (category === 'all') {
      setSelectedCategory('all');
      setSelectedSubcategory('all');
      setExpandedCategory(null);
      return;
    }

    if (categoryHasSubcategories(category)) {
      // Toggle expansion
      if (expandedCategory === category) {
        setExpandedCategory(null);
      } else {
        setExpandedCategory(category);
      }
      // Select the category but not a specific subcategory
      setSelectedCategory(category);
      setSelectedSubcategory('all');
    } else {
      // No subcategories, just select the category
      setSelectedCategory(category);
      setSelectedSubcategory('all');
      setExpandedCategory(null);
    }
  };

  const handleSubcategoryClick = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId);
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === 'all' || file.subcategory_id === selectedSubcategory;
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = (fileType: string | null, fileName: string): 'image' | 'video' | 'audio' | 'pdf' | 'spreadsheet' | 'document' | 'presentation' | 'other' => {
    const type = fileType?.toLowerCase() || '';
    const name = fileName.toLowerCase();
    
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)) return 'image';
    if (type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(name)) return 'video';
    if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(name)) return 'audio';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (/\.(xlsx?|csv|ods)$/i.test(name) || type.includes('spreadsheet')) return 'spreadsheet';
    if (/\.(docx?|odt|rtf|txt)$/i.test(name) || type.includes('document')) return 'document';
    if (/\.(pptx?|odp)$/i.test(name) || type.includes('presentation')) return 'presentation';
    return 'other';
  };

  const getFileIcon = (fileType: ReturnType<typeof getFileType>) => {
    switch (fileType) {
      case 'image': return <FileImage className="w-5 h-5" />;
      case 'video': return <FileVideo className="w-5 h-5" />;
      case 'audio': return <FileAudio className="w-5 h-5" />;
      case 'pdf': return <FileText className="w-5 h-5" />;
      case 'spreadsheet': return <FileSpreadsheet className="w-5 h-5" />;
      case 'document': return <FileType className="w-5 h-5" />;
      case 'presentation': return <FileType className="w-5 h-5" />;
      default: return <File className="w-5 h-5" />;
    }
  };

  const getFileTypeLabel = (file: FileItem): string => {
    // External links
    if (file.is_external_link) {
      return 'LINK';
    }

    const name = file.name.toLowerCase();
    const type = file.file_type?.toLowerCase() || '';
    
    // Word documents
    if (/\.(docx?|odt|rtf)$/i.test(name) || type.includes('wordprocessing') || type.includes('msword')) {
      return 'WORD';
    }
    // PowerPoint presentations
    if (/\.(pptx?|odp)$/i.test(name) || type.includes('presentation') || type.includes('powerpoint')) {
      return 'SLIDE';
    }
    // Excel spreadsheets
    if (/\.(xlsx?|ods)$/i.test(name) || type.includes('spreadsheet') || type.includes('excel')) {
      return 'PLANILHA';
    }
    
    // Default: use file extension or mime type
    return (file.file_type?.split('/')[1] || file.name.split('.').pop() || 'FILE').toUpperCase();
  };

  const getPreviewThumbnail = (file: FileItem) => {
    // External links get special treatment
    if (file.is_external_link) {
      return (
        <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-t-lg">
          <div className="p-6 rounded-2xl bg-background/80 backdrop-blur">
            <Globe className="w-12 h-12 text-cyan-600" />
          </div>
        </div>
      );
    }

    const fileType = getFileType(file.file_type, file.name);
    
    if (fileType === 'image') {
      return (
        <img 
          src={file.file_url} 
          alt={file.name}
          className="w-full h-40 object-cover rounded-t-lg"
          loading="lazy"
        />
      );
    }

    // For PDFs, we could potentially use a PDF preview service, but for now show icon
    const iconColors: Record<string, string> = {
      image: 'from-pink-500/20 to-rose-500/20 text-pink-600',
      video: 'from-purple-500/20 to-violet-500/20 text-purple-600',
      audio: 'from-green-500/20 to-emerald-500/20 text-green-600',
      pdf: 'from-red-500/20 to-orange-500/20 text-red-600',
      spreadsheet: 'from-emerald-500/20 to-teal-500/20 text-emerald-600',
      document: 'from-blue-500/20 to-indigo-500/20 text-blue-600',
      presentation: 'from-orange-500/20 to-amber-500/20 text-orange-600',
      other: 'from-gray-500/20 to-slate-500/20 text-gray-600',
    };

    return (
      <div className={`w-full h-40 flex items-center justify-center bg-gradient-to-br ${iconColors[fileType]} rounded-t-lg`}>
        <div className="p-6 rounded-2xl bg-background/80 backdrop-blur">
          {React.cloneElement(getFileIcon(fileType), { className: 'w-12 h-12' })}
        </div>
      </div>
    );
  };

  const canPreviewInBrowser = (file: FileItem): boolean => {
    const fileType = getFileType(file.file_type, file.name);
    return ['image', 'video', 'audio', 'pdf'].includes(fileType);
  };

  const renderPreviewContent = (file: FileItem) => {
    const fileType = getFileType(file.file_type, file.name);

    switch (fileType) {
      case 'image':
        return (
          <img 
            src={file.file_url} 
            alt={file.name}
            className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg"
          />
        );
      case 'video':
        return (
          <video 
            src={file.file_url} 
            controls 
            className="max-w-full max-h-[70vh] mx-auto rounded-lg"
          >
            Seu navegador não suporta a reprodução de vídeo.
          </video>
        );
      case 'audio':
        return (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="p-8 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20">
              <FileAudio className="w-16 h-16 text-green-600" />
            </div>
            <audio src={file.file_url} controls className="w-full max-w-md">
              Seu navegador não suporta a reprodução de áudio.
            </audio>
          </div>
        );
      case 'pdf':
        return (
          <iframe 
            src={file.file_url} 
            className="w-full h-[70vh] rounded-lg border"
            title={file.name}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="p-6 rounded-full bg-muted">
              {getFileIcon(fileType)}
            </div>
            <p className="text-muted-foreground">
              Prévia não disponível para este tipo de arquivo.
            </p>
            <Button onClick={() => handleDownload(file)}>
              <Download className="w-4 h-4 mr-2" />
              Fazer Download
            </Button>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Materiais Comerciais</h1>
          <p className="text-muted-foreground">
            Acesse e visualize os materiais disponíveis
          </p>
        </div>

        {/* Broken Files Warning - Dev only */}
        {user?.role === 'dev' && (() => {
          const brokenFiles = files.filter(f => isFileBroken(f.file_url));
          if (brokenFiles.length === 0) return null;
          return (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium text-sm">
                      {brokenFiles.length} arquivo(s) com link quebrado (servidor antigo)
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBrokenList(!showBrokenList)}
                    className="gap-1 text-xs"
                  >
                    <List className="w-4 h-4" />
                    {showBrokenList ? 'Ocultar lista' : 'Ver lista completa'}
                  </Button>
                </div>
                {showBrokenList && (
                  <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border bg-background">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">Nome</th>
                          <th className="text-left p-2 font-medium">Categoria</th>
                          <th className="text-left p-2 font-medium">URL antiga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brokenFiles.map(f => (
                          <tr key={f.id} className="border-t">
                            <td className="p-2 font-medium">{f.name}</td>
                            <td className="p-2 text-muted-foreground">{f.category || '—'}</td>
                            <td className="p-2 text-muted-foreground truncate max-w-[300px]">{f.file_url}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar materiais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Category Buttons */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategoryClick('all')}
                className="gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Todas as Categorias
              </Button>
              {categories.map((category) => {
                const hasSubcats = categoryHasSubcategories(category);
                const isExpanded = expandedCategory === category;
                const isSelected = selectedCategory === category;
                
                return (
                  <Button
                    key={category}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleCategoryClick(category)}
                    className="gap-1"
                  >
                    {category}
                    {hasSubcats && (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 ml-1" />
                      )
                    )}
                  </Button>
                );
              })}
            </div>
            
            {/* Subcategories Row */}
            {expandedCategory && categoryHasSubcategories(expandedCategory) && (
              <div className="flex flex-wrap gap-2 pl-4 animate-fade-in">
                <Button
                  variant={selectedSubcategory === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleSubcategoryClick('all')}
                  className="text-sm h-8"
                >
                  Todas
                </Button>
                {getSubcategoriesForCategory(expandedCategory).map((subcat: any) => (
                  <Button
                    key={subcat.id}
                    variant={selectedSubcategory === subcat.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleSubcategoryClick(subcat.id)}
                    className="text-sm h-8"
                  >
                    {subcat.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Nenhum material encontrado com os filtros aplicados' 
                  : 'Nenhum material disponível'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFiles.map((file) => {
              const fileType = getFileType(file.file_type, file.name);
              const broken = isFileBroken(file.file_url);
              
              return (
                <Card 
                  key={file.id} 
                  className={`group overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md ${broken ? 'ring-2 ring-destructive/40 opacity-70' : ''}`}
                >
                  {/* Broken file warning */}
                  {broken && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Arquivo indisponível — reenvio necessário
                    </div>
                  )}
                  {/* Thumbnail/Preview Area */}
                  <div 
                    className="relative cursor-pointer" 
                    onClick={() => file.is_external_link ? handleAccessLink(file) : handlePreview(file)}
                  >
                    {getPreviewThumbnail(file)}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-t-lg">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          file.is_external_link ? handleAccessLink(file) : handlePreview(file);
                        }}
                      >
                        {file.is_external_link ? (
                          <>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Acessar
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Visualizar
                          </>
                        )}
                      </Button>
                    </div>

                    {/* File Type Badge */}
                    <Badge 
                      variant={file.is_external_link ? "default" : "secondary"}
                      className={`absolute top-2 right-2 text-xs uppercase font-medium ${
                        file.is_external_link ? 'bg-cyan-600 hover:bg-cyan-700' : ''
                      }`}
                    >
                      {getFileTypeLabel(file)}
                    </Badge>
                  </div>

                  {/* File Info */}
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm line-clamp-2 leading-snug">
                        {file.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {file.category && (
                          <>
                            <span>{file.category}</span>
                            {!file.is_external_link && <span>•</span>}
                          </>
                        )}
                        {!file.is_external_link && <span>{formatFileSize(file.file_size)}</span>}
                      </div>
                    </div>

                    {file.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {file.description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      {file.is_external_link ? (
                        <Button
                          size="sm"
                          className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                          onClick={() => handleAccessLink(file)}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Acessar
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePreview(file)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  {previewFile && getFileIcon(getFileType(previewFile.file_type, previewFile.name))}
                  <span className="truncate max-w-[300px] sm:max-w-[500px]">
                    {previewFile?.name}
                  </span>
                </DialogTitle>
              </div>
              {previewFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {previewFile.category && <Badge variant="outline">{previewFile.category}</Badge>}
                  <span>{formatFileSize(previewFile.file_size)}</span>
                </div>
              )}
            </DialogHeader>

            {/* Preview Content */}
            <div className="mt-4">
              {previewFile && renderPreviewContent(previewFile)}
            </div>

            {/* Footer Actions */}
            {previewFile && canPreviewInBrowser(previewFile) && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setPreviewFile(null)}>
                  Fechar
                </Button>
                <Button onClick={() => handleDownload(previewFile)}>
                  <Download className="w-4 h-4 mr-2" />
                  Fazer Download
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Downloads;
