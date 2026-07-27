import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { FileItem, AppRole, ROLE_LABELS, Subcategory, REGIONS } from '@/types/auth';
import { 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Search, 
  Download,
  Loader2,
  File,
  X,
  Pencil,
  Link,
  Globe,
  MapPin,
  Eye,
  Image,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  Presentation,
  FolderInput,
  CheckSquare
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const ALL_ROLES: AppRole[] = ['admin', 'gerente', 'vendedor', 'diretoria'];

interface Category {
  id: string;
  name: string;
  description: string | null;
}

const FileManagement: React.FC = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [fileToEdit, setFileToEdit] = useState<FileItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Batch selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [batchMoveDialogOpen, setBatchMoveDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchMoveCategoryId, setBatchMoveCategoryId] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    visibility: ['vendedor', 'gerente', 'admin', 'diretoria'] as AppRole[],
    regions: [] as string[],
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    visibility: [] as AppRole[],
    regions: [] as string[],
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkFormData, setLinkFormData] = useState({
    name: '',
    description: '',
    url: '',
    category_id: '',
    subcategory_id: '',
    visibility: ['vendedor', 'gerente', 'admin', 'diretoria'] as AppRole[],
    regions: [] as string[],
  });
  const [savingLink, setSavingLink] = useState(false);
  
  // Preview state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  useEffect(() => {
    fetchFiles();
    fetchCategories();
    fetchSubcategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSubcategories(data || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const fetchFiles = async () => {
    try {
      const { data: filesData, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch visibility and subcategory info for each file
      const filesWithDetails = await Promise.all(
        (filesData || []).map(async (file) => {
          const { data: visibility } = await supabase
            .from('file_visibility')
            .select('visible_to_role')
            .eq('file_id', file.id);
          
          let subcategory: Subcategory | undefined;
          if (file.subcategory_id) {
            const { data: subData } = await supabase
              .from('subcategories')
              .select('*')
              .eq('id', file.subcategory_id)
              .maybeSingle();
            subcategory = subData || undefined;
          }
          
          return {
            ...file,
            visibility: visibility?.map(v => v.visible_to_role as AppRole) || [],
            subcategory,
          };
        })
      );

      setFiles(filesWithDetails);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      if (!formData.name && newFiles.length === 1) {
        setFormData(prev => ({ ...prev, name: newFiles[0].name.replace(/\.[^/.]+$/, '') }));
      }
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVisibilityChange = (role: AppRole, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      visibility: checked
        ? [...prev.visibility, role]
        : prev.visibility.filter(r => r !== role),
    }));
  };

  const handleEditVisibilityChange = (role: AppRole, checked: boolean) => {
    setEditFormData(prev => ({
      ...prev,
      visibility: checked
        ? [...prev.visibility, role]
        : prev.visibility.filter(r => r !== role),
    }));
  };

  const handleRegionChange = (region: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      regions: checked
        ? [...prev.regions, region]
        : prev.regions.filter(r => r !== region),
    }));
  };

  const handleEditRegionChange = (region: string, checked: boolean) => {
    setEditFormData(prev => ({
      ...prev,
      regions: checked
        ? [...prev.regions, region]
        : prev.regions.filter(r => r !== region),
    }));
  };

  const handleLinkRegionChange = (region: string, checked: boolean) => {
    setLinkFormData(prev => ({
      ...prev,
      regions: checked
        ? [...prev.regions, region]
        : prev.regions.filter(r => r !== region),
    }));
  };

  const handleCategoryChange = (categoryId: string) => {
    setFormData(prev => ({ ...prev, category_id: categoryId, subcategory_id: '' }));
  };

  const handleEditCategoryChange = (categoryId: string) => {
    setEditFormData(prev => ({ ...prev, category_id: categoryId, subcategory_id: '' }));
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sub => sub.category_id === categoryId);
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId)?.name || '';
  };

  const getSubcategoryName = (subcategoryId: string) => {
    return subcategories.find(sub => sub.id === subcategoryId)?.name || '';
  };

  const openEditDialog = (file: FileItem) => {
    setFileToEdit(file);
    // Find category_id from the file's category name or subcategory
    let categoryId = '';
    if (file.subcategory_id && file.subcategory) {
      categoryId = file.subcategory.category_id;
    } else if (file.category) {
      const cat = categories.find(c => c.name === file.category);
      categoryId = cat?.id || '';
    }
    
    setEditFormData({
      name: file.name,
      description: file.description || '',
      category_id: categoryId,
      subcategory_id: file.subcategory_id || '',
      visibility: file.visibility || [],
      regions: [], // Will be loaded separately
    });
    
    // Load region visibility for file
    supabase
      .from('file_region_visibility')
      .select('region')
      .eq('file_id', file.id)
      .then(({ data }) => {
        if (data) {
          setEditFormData(prev => ({
            ...prev,
            regions: data.map(r => r.region),
          }));
        }
      });
    
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!fileToEdit) return;

    if (!editFormData.name.trim()) {
      toast.error('Informe o nome do arquivo');
      return;
    }

    if (editFormData.visibility.length === 0) {
      toast.error('Selecione pelo menos um cargo para visualização');
      return;
    }

    setUpdating(true);

    try {
      // Get category name for backwards compatibility
      const categoryName = editFormData.category_id ? getCategoryName(editFormData.category_id) : null;

      // Update file record
      const { error: updateError } = await supabase
        .from('files')
        .update({
          name: editFormData.name,
          description: editFormData.description || null,
          category: categoryName,
          subcategory_id: editFormData.subcategory_id || null,
        })
        .eq('id', fileToEdit.id);

      if (updateError) throw updateError;

      // Delete existing visibility records
      const { error: deleteVisibilityError } = await supabase
        .from('file_visibility')
        .delete()
        .eq('file_id', fileToEdit.id);

      if (deleteVisibilityError) throw deleteVisibilityError;

      // Insert new visibility records
      const visibilityRecords = editFormData.visibility.map(role => ({
        file_id: fileToEdit.id,
        visible_to_role: role,
      }));

      const { error: visibilityError } = await supabase
        .from('file_visibility')
        .insert(visibilityRecords);

      if (visibilityError) throw visibilityError;

      // Delete existing region visibility records
      await supabase
        .from('file_region_visibility')
        .delete()
        .eq('file_id', fileToEdit.id);

      // Insert new region visibility records if any
      if (editFormData.regions.length > 0) {
        const regionRecords = editFormData.regions.map(region => ({
          file_id: fileToEdit.id,
          region,
        }));

        await supabase.from('file_region_visibility').insert(regionRecords);
      }

      toast.success('Arquivo atualizado com sucesso');
      setEditDialogOpen(false);
      setFileToEdit(null);
      fetchFiles();
    } catch (error: any) {
      console.error('Error updating file:', error);
      toast.error(error.message || 'Erro ao atualizar arquivo');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecione pelo menos um arquivo');
      return;
    }

    if (selectedFiles.length === 1 && !formData.name.trim()) {
      toast.error('Informe o nome do arquivo');
      return;
    }

    if (formData.visibility.length === 0) {
      toast.error('Selecione pelo menos um cargo para visualização');
      return;
    }

    setUploading(true);

    try {
      const categoryName = formData.category_id ? getCategoryName(formData.category_id) : null;
      let successCount = 0;

      for (const file of selectedFiles) {
        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(fileName, file);

        if (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('files')
          .getPublicUrl(fileName);

        // Use custom name for single file, original name for multiple
        const displayName = selectedFiles.length === 1 
          ? formData.name 
          : file.name.replace(/\.[^/.]+$/, '');

        // Insert file record
        const { data: fileRecord, error: insertError } = await supabase
          .from('files')
          .insert({
            name: displayName,
            description: formData.description || null,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            category: categoryName,
            subcategory_id: formData.subcategory_id || null,
            created_by: user?.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting record for ${file.name}:`, insertError);
          continue;
        }

        // Insert visibility records
        const visibilityRecords = formData.visibility.map(role => ({
          file_id: fileRecord.id,
          visible_to_role: role,
        }));

        await supabase.from('file_visibility').insert(visibilityRecords);

        // Insert region visibility records if any
        if (formData.regions.length > 0) {
          const regionRecords = formData.regions.map(region => ({
            file_id: fileRecord.id,
            region,
          }));

          await supabase.from('file_region_visibility').insert(regionRecords);
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`${successCount} arquivo(s) enviado(s) com sucesso`);
        setDialogOpen(false);
        resetForm();
        fetchFiles();
      } else {
        toast.error('Erro ao enviar arquivos');
      }
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast.error(error.message || 'Erro ao enviar arquivos');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    try {
      // Extract filename from URL
      const urlParts = fileToDelete.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      await supabase.storage.from('files').remove([fileName]);

      // Delete file record (visibility will cascade)
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileToDelete.id);

      if (error) throw error;

      toast.success('Arquivo excluído com sucesso');
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      fetchFiles();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.message || 'Erro ao excluir arquivo');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category_id: '',
      subcategory_id: '',
      visibility: ['vendedor'],
      regions: [],
    });
    setSelectedFiles([]);
  };

  const resetLinkForm = () => {
    setLinkFormData({
      name: '',
      description: '',
      url: '',
      category_id: '',
      subcategory_id: '',
      visibility: ['vendedor'],
      regions: [],
    });
  };

  const handleLinkCategoryChange = (categoryId: string) => {
    setLinkFormData(prev => ({ ...prev, category_id: categoryId, subcategory_id: '' }));
  };

  const handleLinkVisibilityChange = (role: AppRole, checked: boolean) => {
    setLinkFormData(prev => ({
      ...prev,
      visibility: checked
        ? [...prev.visibility, role]
        : prev.visibility.filter(r => r !== role),
    }));
  };

  const handleSaveLink = async () => {
    if (!linkFormData.name.trim()) {
      toast.error('Informe o nome do link');
      return;
    }

    if (!linkFormData.url.trim()) {
      toast.error('Informe a URL do link');
      return;
    }

    // Validate URL
    try {
      new URL(linkFormData.url);
    } catch {
      toast.error('URL inválida. Use o formato completo (ex: https://exemplo.com)');
      return;
    }

    if (linkFormData.visibility.length === 0) {
      toast.error('Selecione pelo menos um cargo para visualização');
      return;
    }

    setSavingLink(true);

    try {
      const categoryName = linkFormData.category_id ? getCategoryName(linkFormData.category_id) : null;

      // Insert link record
      const { data: linkRecord, error: insertError } = await supabase
        .from('files')
        .insert({
          name: linkFormData.name,
          description: linkFormData.description || null,
          file_url: linkFormData.url,
          file_type: 'link',
          file_size: null,
          category: categoryName,
          subcategory_id: linkFormData.subcategory_id || null,
          created_by: user?.id,
          is_external_link: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert visibility records
      const visibilityRecords = linkFormData.visibility.map(role => ({
        file_id: linkRecord.id,
        visible_to_role: role,
      }));

      await supabase.from('file_visibility').insert(visibilityRecords);

      // Insert region visibility records if any
      if (linkFormData.regions.length > 0) {
        const regionRecords = linkFormData.regions.map(region => ({
          file_id: linkRecord.id,
          region,
        }));

        await supabase.from('file_region_visibility').insert(regionRecords);
      }

      toast.success('Link adicionado com sucesso');
      setLinkDialogOpen(false);
      resetLinkForm();
      fetchFiles();
    } catch (error: any) {
      console.error('Error saving link:', error);
      toast.error(error.message || 'Erro ao adicionar link');
    } finally {
      setSavingLink(false);
    }
  };

  const linkFilteredSubcategories = getSubcategoriesForCategory(linkFormData.category_id);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = (file: FileItem): string => {
    if (file.is_external_link) return 'link';
    const mimeType = file.file_type?.toLowerCase() || '';
    const url = file.file_url.toLowerCase();
    
    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(url)) return 'image';
    if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|avi)$/.test(url)) return 'video';
    if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(url)) return 'audio';
    if (mimeType === 'application/pdf' || url.endsWith('.pdf')) return 'pdf';
    if (mimeType.includes('word') || /\.(doc|docx)$/.test(url)) return 'word';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || /\.(ppt|pptx)$/.test(url)) return 'powerpoint';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || /\.(xls|xlsx)$/.test(url)) return 'excel';
    return 'other';
  };

  const getFileIcon = (file: FileItem) => {
    const type = getFileType(file);
    switch (type) {
      case 'link': return <Globe className="w-4 h-4 text-cyan-600" />;
      case 'image': return <Image className="w-4 h-4 text-green-600" />;
      case 'video': return <FileVideo className="w-4 h-4 text-purple-600" />;
      case 'audio': return <FileAudio className="w-4 h-4 text-orange-600" />;
      case 'pdf': return <FileText className="w-4 h-4 text-red-600" />;
      case 'word': return <FileText className="w-4 h-4 text-blue-600" />;
      case 'powerpoint': return <Presentation className="w-4 h-4 text-orange-500" />;
      case 'excel': return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
      default: return <FileText className="w-4 h-4 text-primary" />;
    }
  };

  const canPreviewInBrowser = (file: FileItem): boolean => {
    const type = getFileType(file);
    return ['image', 'video', 'audio', 'pdf', 'link'].includes(type);
  };

  const openPreview = (file: FileItem) => {
    setPreviewFile(file);
    setPreviewDialogOpen(true);
  };

  const renderPreviewContent = () => {
    if (!previewFile) return null;
    
    const type = getFileType(previewFile);
    
    switch (type) {
      case 'link':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Globe className="w-16 h-16 text-cyan-600" />
            <p className="text-center text-muted-foreground">
              Este é um link externo. Clique abaixo para acessar.
            </p>
            <Button onClick={() => window.open(previewFile.file_url, '_blank')}>
              <Link className="w-4 h-4 mr-2" />
              Acessar Link
            </Button>
          </div>
        );
      case 'image':
        return (
          <div className="flex justify-center">
            <img 
              src={previewFile.file_url} 
              alt={previewFile.name}
              className="max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        );
      case 'video':
        return (
          <video 
            src={previewFile.file_url} 
            controls 
            className="w-full max-h-[70vh] rounded-lg"
          >
            Seu navegador não suporta reprodução de vídeo.
          </video>
        );
      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <FileAudio className="w-16 h-16 text-orange-600" />
            <audio src={previewFile.file_url} controls className="w-full max-w-md">
              Seu navegador não suporta reprodução de áudio.
            </audio>
          </div>
        );
      case 'pdf':
        return (
          <iframe 
            src={previewFile.file_url} 
            className="w-full h-[70vh] rounded-lg border"
            title={previewFile.name}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <FileText className="w-16 h-16 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Visualização não disponível para este tipo de arquivo.
            </p>
            <Button onClick={() => window.open(previewFile.file_url, '_blank')}>
              <Download className="w-4 h-4 mr-2" />
              Baixar Arquivo
            </Button>
          </div>
        );
    }
  };

  const getFileDisplayCategory = (file: FileItem) => {
    if (file.subcategory) {
      const cat = categories.find(c => c.id === file.subcategory?.category_id);
      return `${cat?.name || ''} > ${file.subcategory.name}`;
    }
    return file.category || '-';
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.subcategory?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = 
      filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !file.category) ||
      file.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const filteredSubcategories = getSubcategoriesForCategory(formData.category_id);
  const editFilteredSubcategories = getSubcategoriesForCategory(editFormData.category_id);

  // Batch selection helpers
  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const clearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleBatchMove = async () => {
    if (!batchMoveCategoryId || selectedFileIds.size === 0) return;
    
    setBatchProcessing(true);
    try {
      const categoryName = getCategoryName(batchMoveCategoryId);
      
      const { error } = await supabase
        .from('files')
        .update({ category: categoryName, updated_at: new Date().toISOString() })
        .in('id', Array.from(selectedFileIds));

      if (error) throw error;

      toast.success(`${selectedFileIds.size} arquivo(s) movido(s) para ${categoryName}`);
      setBatchMoveDialogOpen(false);
      setBatchMoveCategoryId('');
      clearSelection();
      fetchFiles();
    } catch (error: any) {
      console.error('Error moving files:', error);
      toast.error(error.message || 'Erro ao mover arquivos');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedFileIds.size === 0) return;
    
    setBatchProcessing(true);
    try {
      const filesToDelete = files.filter(f => selectedFileIds.has(f.id));
      
      // Delete from storage (only non-external links)
      for (const file of filesToDelete) {
        if (!file.is_external_link) {
          const urlParts = file.file_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          await supabase.storage.from('files').remove([fileName]);
        }
      }

      // Delete file records
      const { error } = await supabase
        .from('files')
        .delete()
        .in('id', Array.from(selectedFileIds));

      if (error) throw error;

      toast.success(`${selectedFileIds.size} arquivo(s) excluído(s)`);
      setBatchDeleteDialogOpen(false);
      clearSelection();
      fetchFiles();
    } catch (error: any) {
      console.error('Error deleting files:', error);
      toast.error(error.message || 'Erro ao excluir arquivos');
    } finally {
      setBatchProcessing(false);
    }
  };

  const selectedCount = selectedFileIds.size;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gerenciamento de Arquivos</h1>
            <p className="text-muted-foreground">
              Faça upload de arquivos e controle a visibilidade por cargo
            </p>
          </div>
          <div className="flex gap-2">
            {/* Add Link Button */}
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => { resetLinkForm(); setLinkDialogOpen(true); }}>
                  <Link className="w-4 h-4 mr-2" />
                  Novo Link
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-cyan-600" />
                    Adicionar Link Externo
                  </DialogTitle>
                  <DialogDescription>
                    Adicione um link externo para ser acessado na página de materiais
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="link-name">Nome *</Label>
                    <Input
                      id="link-name"
                      value={linkFormData.name}
                      onChange={(e) => setLinkFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome do link"
                    />
                  </div>

                  {/* URL */}
                  <div className="space-y-2">
                    <Label htmlFor="link-url">URL *</Label>
                    <Input
                      id="link-url"
                      value={linkFormData.url}
                      onChange={(e) => setLinkFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://exemplo.com"
                      type="url"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="link-description">Descrição</Label>
                    <Textarea
                      id="link-description"
                      value={linkFormData.description}
                      onChange={(e) => setLinkFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição opcional"
                      rows={2}
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={linkFormData.category_id}
                      onValueChange={handleLinkCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhuma categoria cadastrada
                          </SelectItem>
                        ) : (
                          categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subcategory */}
                  {linkFormData.category_id && (
                    <div className="space-y-2">
                      <Label>Subcategoria</Label>
                      <Select
                        value={linkFormData.subcategory_id}
                        onValueChange={(value) => setLinkFormData(prev => ({ ...prev, subcategory_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {linkFilteredSubcategories.length === 0 ? (
                            <SelectItem value="none" disabled>
                              Nenhuma subcategoria nesta categoria
                            </SelectItem>
                          ) : (
                            linkFilteredSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Visibility */}
                  <div className="space-y-2">
                    <Label>Visível para *</Label>
                    <div className="flex flex-wrap gap-4">
                      {ALL_ROLES.map(role => (
                        <div key={role} className="flex items-center space-x-2">
                          <Checkbox
                            id={`link-role-${role}`}
                            checked={linkFormData.visibility.includes(role)}
                            onCheckedChange={(checked) => 
                              handleLinkVisibilityChange(role, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`link-role-${role}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {ROLE_LABELS[role]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Region Visibility - only show when vendedor is selected */}
                  {linkFormData.visibility.includes('vendedor') && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Restringir por Região (Vendedores)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para todos os vendedores verem. Selecione regiões para restringir.
                      </p>
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                        {REGIONS.map(region => (
                          <div key={region.value} className="flex items-center space-x-1">
                            <Checkbox
                              id={`link-region-${region.value}`}
                              checked={linkFormData.regions.includes(region.value)}
                              onCheckedChange={(checked) => 
                                handleLinkRegionChange(region.value, checked as boolean)
                              }
                            />
                            <label
                              htmlFor={`link-region-${region.value}`}
                              className="text-xs cursor-pointer"
                            >
                              {region.value}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full bg-cyan-600 hover:bg-cyan-700" 
                    onClick={handleSaveLink}
                    disabled={savingLink}
                  >
                    {savingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Adicionar Link
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add File Button */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Arquivo
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar Arquivo</DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo e defina quem pode visualizá-lo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* File Input */}
                <div className="space-y-2">
                  <Label>Arquivos *</Label>
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                          <File className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="flex-1 truncate text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => removeSelectedFile(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-sm text-muted-foreground">
                      {selectedFiles.length > 0 ? 'Adicionar mais arquivos' : 'Clique para selecionar'}
                    </span>
                    <span className="text-xs text-muted-foreground">Sem limite de tamanho</span>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>

                {/* Name - only show for single file */}
                {selectedFiles.length <= 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome {selectedFiles.length === 1 ? '*' : ''}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome do arquivo"
                    />
                    {selectedFiles.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Para múltiplos arquivos, os nomes originais serão usados
                      </p>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição opcional"
                    rows={2}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhuma categoria cadastrada
                        </SelectItem>
                      ) : (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Cadastre categorias no menu Categorias primeiro
                    </p>
                  )}
                </div>

                {/* Subcategory */}
                {formData.category_id && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Subcategoria</Label>
                    <Select
                      value={formData.subcategory_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, subcategory_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubcategories.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhuma subcategoria nesta categoria
                          </SelectItem>
                        ) : (
                          filteredSubcategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Visibility */}
                <div className="space-y-2">
                  <Label>Visível para *</Label>
                  <div className="flex flex-wrap gap-4">
                    {ALL_ROLES.map(role => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={formData.visibility.includes(role)}
                          onCheckedChange={(checked) => 
                            handleVisibilityChange(role, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={`role-${role}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {ROLE_LABELS[role]}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Region Visibility - only show when vendedor is selected */}
                {formData.visibility.includes('vendedor') && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Restringir por Região (Vendedores)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para todos os vendedores verem. Selecione regiões para restringir.
                    </p>
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {REGIONS.map(region => (
                        <div key={region.value} className="flex items-center space-x-1">
                          <Checkbox
                            id={`upload-region-${region.value}`}
                            checked={formData.regions.includes(region.value)}
                            onCheckedChange={(checked) => 
                              handleRegionChange(region.value, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`upload-region-${region.value}`}
                            className="text-xs cursor-pointer"
                          >
                            {region.value}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full" 
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar Arquivo
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar arquivos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="uncategorized">Sem categoria</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Batch Actions Bar */}
        {selectedCount > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-primary" />
                  <span className="font-medium">{selectedCount} arquivo(s) selecionado(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchMoveDialogOpen(true)}
                  >
                    <FolderInput className="w-4 h-4 mr-2" />
                    Mover para Categoria
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                    onClick={() => setBatchDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Selecionados
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Files Table */}
        <Card>
          <CardHeader>
            <CardTitle>Arquivos</CardTitle>
            <CardDescription>
              {filteredFiles.length} arquivo(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum arquivo encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => (
                      <TableRow 
                        key={file.id}
                        className={selectedFileIds.has(file.id) ? 'bg-primary/5' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedFileIds.has(file.id)}
                            onCheckedChange={() => toggleFileSelection(file.id)}
                            aria-label={`Selecionar ${file.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(file)}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{file.name}</p>
                                {file.is_external_link && (
                                  <Badge variant="outline" className="text-xs text-cyan-600 border-cyan-600">
                                    LINK
                                  </Badge>
                                )}
                              </div>
                              {file.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {file.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getFileDisplayCategory(file)}</TableCell>
                        <TableCell>
                          {file.is_external_link ? '-' : formatFileSize(file.file_size)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openPreview(file)}
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(file.file_url, '_blank')}
                              title={file.is_external_link ? 'Acessar link' : 'Download'}
                            >
                              {file.is_external_link ? (
                                <Link className="w-4 h-4 text-cyan-600" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(file)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setFileToDelete(file);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir arquivo</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o arquivo "{fileToDelete?.name}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewFile && getFileIcon(previewFile)}
                {previewFile?.name}
              </DialogTitle>
              {previewFile?.description && (
                <DialogDescription>{previewFile.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="mt-4">
              {renderPreviewContent()}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Arquivo</DialogTitle>
              <DialogDescription>
                Altere as informações do arquivo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do arquivo"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição opcional"
                  rows={2}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={editFormData.category_id}
                  onValueChange={handleEditCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhuma categoria cadastrada
                      </SelectItem>
                    ) : (
                      categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategory */}
              {editFormData.category_id && (
                <div className="space-y-2">
                  <Label htmlFor="edit-subcategory">Subcategoria</Label>
                  <Select
                    value={editFormData.subcategory_id}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, subcategory_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma subcategoria (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {editFilteredSubcategories.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhuma subcategoria nesta categoria
                        </SelectItem>
                      ) : (
                        editFilteredSubcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Visibility */}
              <div className="space-y-2">
                <Label>Visível para *</Label>
                <div className="flex flex-wrap gap-4">
                  {ALL_ROLES.map(role => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role}`}
                        checked={editFormData.visibility.includes(role)}
                        onCheckedChange={(checked) => 
                          handleEditVisibilityChange(role, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`edit-role-${role}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {ROLE_LABELS[role]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Region Visibility - only show when vendedor is selected */}
              {editFormData.visibility.includes('vendedor') && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Restringir por Região (Vendedores)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para todos os vendedores verem. Selecione regiões para restringir.
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                    {REGIONS.map(region => (
                      <div key={region.value} className="flex items-center space-x-1">
                        <Checkbox
                          id={`edit-region-${region.value}`}
                          checked={editFormData.regions.includes(region.value)}
                          onCheckedChange={(checked) => 
                            handleEditRegionChange(region.value, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={`edit-region-${region.value}`}
                          className="text-xs cursor-pointer"
                        >
                          {region.value}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full" 
                onClick={handleUpdate}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Batch Move Dialog */}
        <AlertDialog open={batchMoveDialogOpen} onOpenChange={setBatchMoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mover Arquivos</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione a categoria de destino para {selectedCount} arquivo(s).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Select
                value={batchMoveCategoryId}
                onValueChange={setBatchMoveCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBatchMoveCategoryId('')}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleBatchMove}
                disabled={!batchMoveCategoryId || batchProcessing}
              >
                {batchProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Movendo...
                  </>
                ) : (
                  'Mover'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Delete Dialog */}
        <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Arquivos</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {selectedCount} arquivo(s)?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleBatchDelete}
                disabled={batchProcessing}
                className="bg-destructive hover:bg-destructive/90"
              >
                {batchProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default FileManagement;