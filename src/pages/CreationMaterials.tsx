import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  Upload,
  FolderPlus,
  Search,
  Loader2,
  FileText,
  Image,
  Video,
  File,
  Link as LinkIcon,
  Download,
  Eye,
  Trash2,
  Edit,
  ExternalLink,
  X,
  CloudUpload,
  FolderInput,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CreationCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface CreationSubcategory {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  created_at: string;
}

interface CreationFile {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category_id: string | null;
  subcategory_id: string | null;
  is_external_link: boolean;
  created_at: string;
}

const getFileIcon = (fileType: string | null, isExternalLink: boolean) => {
  if (isExternalLink) return <LinkIcon className="w-5 h-5 text-blue-500" />;
  if (!fileType) return <File className="w-5 h-5 text-muted-foreground" />;
  
  if (fileType.includes("image")) return <Image className="w-5 h-5 text-green-500" />;
  if (fileType.includes("video")) return <Video className="w-5 h-5 text-purple-500" />;
  if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;
};

const CreationMaterials: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CreationCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CreationSubcategory[]>([]);
  const [files, setFiles] = useState<CreationFile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form states
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryDescription, setSubcategoryDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  
  // File form states
  const [fileName, setFileName] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [isExternalLink, setIsExternalLink] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Edit states
  const [editingCategory, setEditingCategory] = useState<CreationCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<CreationSubcategory | null>(null);
  const [editingFile, setEditingFile] = useState<CreationFile | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editFileDescription, setEditFileDescription] = useState("");
  const [showEditFileDialog, setShowEditFileDialog] = useState(false);

  // Move file states
  const [showMoveFileDialog, setShowMoveFileDialog] = useState(false);
  const [movingFile, setMovingFile] = useState<CreationFile | null>(null);
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState<string | null>(null);
  const [moveTargetSubcategoryId, setMoveTargetSubcategoryId] = useState<string | null>(null);
  
  // Preview/Delete states
  const [previewFile, setPreviewFile] = useState<CreationFile | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: "category" | "subcategory" | "file"; item: any } | null>(null);

  const hasAccess = user?.role === "dev" || user?.role === "criacao";

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, subcategoriesRes, filesRes] = await Promise.all([
        supabase.from("creation_categories").select("*").order("name"),
        supabase.from("creation_subcategories").select("*").order("name"),
        supabase.from("creation_files").select("*").order("created_at", { ascending: false }),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (subcategoriesRes.error) throw subcategoriesRes.error;
      if (filesRes.error) throw filesRes.error;

      setCategories(categoriesRes.data || []);
      setSubcategories(subcategoriesRes.data || []);
      setFiles(filesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Category CRUD
  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    try {
      const { error } = await supabase.from("creation_categories").insert({
        name: categoryName.trim(),
        description: categoryDescription.trim() || null,
        created_by: user?.id,
      });

      if (error) throw error;
      toast.success("Categoria criada com sucesso!");
      setShowCategoryDialog(false);
      setCategoryName("");
      setCategoryDescription("");
      fetchData();
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Erro ao criar categoria");
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryName.trim()) return;

    try {
      const { error } = await supabase
        .from("creation_categories")
        .update({
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
        })
        .eq("id", editingCategory.id);

      if (error) throw error;
      toast.success("Categoria atualizada!");
      setEditingCategory(null);
      setShowCategoryDialog(false);
      setCategoryName("");
      setCategoryDescription("");
      fetchData();
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Erro ao atualizar categoria");
    }
  };

  // Subcategory CRUD
  const handleCreateSubcategory = async () => {
    if (!subcategoryName.trim() || !selectedCategoryId) {
      toast.error("Nome e categoria são obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("creation_subcategories").insert({
        name: subcategoryName.trim(),
        description: subcategoryDescription.trim() || null,
        category_id: selectedCategoryId,
        created_by: user?.id,
      });

      if (error) throw error;
      toast.success("Subcategoria criada com sucesso!");
      setShowSubcategoryDialog(false);
      setSubcategoryName("");
      setSubcategoryDescription("");
      setSelectedCategoryId(null);
      fetchData();
    } catch (error) {
      console.error("Error creating subcategory:", error);
      toast.error("Erro ao criar subcategoria");
    }
  };

  const handleUpdateSubcategory = async () => {
    if (!editingSubcategory || !subcategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from("creation_subcategories")
        .update({
          name: subcategoryName.trim(),
          description: subcategoryDescription.trim() || null,
        })
        .eq("id", editingSubcategory.id);

      if (error) throw error;
      toast.success("Subcategoria atualizada!");
      setEditingSubcategory(null);
      setShowSubcategoryDialog(false);
      setSubcategoryName("");
      setSubcategoryDescription("");
      fetchData();
    } catch (error) {
      console.error("Error updating subcategory:", error);
      toast.error("Erro ao atualizar subcategoria");
    }
  };

  // File upload - handles multiple files
  const handleFileUpload = async () => {
    if (isExternalLink) {
      // Single external link upload
      if (!fileName.trim()) {
        toast.error("Nome do arquivo é obrigatório");
        return;
      }
      if (!externalUrl.trim()) {
        toast.error("URL é obrigatória para links externos");
        return;
      }

      setUploading(true);
      try {
        const { error } = await supabase.from("creation_files").insert({
          name: fileName.trim(),
          description: fileDescription.trim() || null,
          file_url: externalUrl.trim(),
          file_type: null,
          file_size: null,
          category_id: selectedCategoryId || null,
          subcategory_id: selectedSubcategoryId || null,
          is_external_link: true,
          created_by: user?.id,
        });

        if (error) throw error;
        toast.success("Link adicionado com sucesso!");
        resetFileForm();
        setShowFileDialog(false);
        fetchData();
      } catch (error) {
        console.error("Error adding link:", error);
        toast.error("Erro ao adicionar link");
      } finally {
        setUploading(false);
      }
      return;
    }

    // Multiple file upload
    if (uploadingFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo para upload");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = uploadingFiles.length;
      let uploadedCount = 0;

      for (const file of uploadingFiles) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("creation-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("creation-files")
          .getPublicUrl(filePath);

        const { error } = await supabase.from("creation_files").insert({
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for name
          description: null,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          category_id: selectedCategoryId || null,
          subcategory_id: selectedSubcategoryId || null,
          is_external_link: false,
          created_by: user?.id,
        });

        if (error) throw error;

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      toast.success(`${totalFiles} arquivo(s) adicionado(s) com sucesso!`);
      resetFileForm();
      setShowFileDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Erro ao fazer upload dos arquivos");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetFileForm = () => {
    setFileName("");
    setFileDescription("");
    setIsExternalLink(false);
    setExternalUrl("");
    setUploadingFiles([]);
    setSelectedCategoryId(null);
    setSelectedSubcategoryId(null);
    setUploadProgress(0);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter((file) => {
      const validTypes = [
        "image/",
        "video/",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
      ];
      return validTypes.some((type) => file.type.startsWith(type) || file.type.includes(type));
    });

    if (validFiles.length !== droppedFiles.length) {
      toast.warning("Alguns arquivos foram ignorados por não serem suportados");
    }

    if (validFiles.length > 0) {
      setUploadingFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setUploadingFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      let error;
      if (deleteItem.type === "category") {
        const result = await supabase
          .from("creation_categories")
          .delete()
          .eq("id", deleteItem.item.id);
        error = result.error;
      } else if (deleteItem.type === "subcategory") {
        const result = await supabase
          .from("creation_subcategories")
          .delete()
          .eq("id", deleteItem.item.id);
        error = result.error;
      } else {
        // Delete file from storage if not external
        if (!deleteItem.item.is_external_link && deleteItem.item.file_url) {
          const path = deleteItem.item.file_url.split("/").pop();
          if (path) {
            await supabase.storage.from("creation-files").remove([path]);
          }
        }
        const result = await supabase
          .from("creation_files")
          .delete()
          .eq("id", deleteItem.item.id);
        error = result.error;
      }

      if (error) throw error;
      toast.success("Item excluído com sucesso!");
      setDeleteItem(null);
      setShowDeleteDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir item");
    }
  };

  const openEditCategory = (category: CreationCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setShowCategoryDialog(true);
  };

  const openEditSubcategory = (subcategory: CreationSubcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryName(subcategory.name);
    setSubcategoryDescription(subcategory.description || "");
    setShowSubcategoryDialog(true);
  };

  const openEditFile = (file: CreationFile) => {
    setEditingFile(file);
    setEditFileName(file.name);
    setEditFileDescription(file.description || "");
    setShowEditFileDialog(true);
  };

  const handleUpdateFile = async () => {
    if (!editingFile || !editFileName.trim()) {
      toast.error("Nome do arquivo é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from("creation_files")
        .update({
          name: editFileName.trim(),
          description: editFileDescription.trim() || null,
        })
        .eq("id", editingFile.id);

      if (error) throw error;
      toast.success("Arquivo atualizado!");
      setEditingFile(null);
      setShowEditFileDialog(false);
      setEditFileName("");
      setEditFileDescription("");
      fetchData();
    } catch (error) {
      console.error("Error updating file:", error);
      toast.error("Erro ao atualizar arquivo");
    }
  };

  const openPreview = (file: CreationFile) => {
    setPreviewFile(file);
    setShowPreviewDialog(true);
  };

  const openMoveFile = (file: CreationFile) => {
    setMovingFile(file);
    setMoveTargetCategoryId(file.category_id);
    setMoveTargetSubcategoryId(file.subcategory_id);
    setShowMoveFileDialog(true);
  };

  const handleMoveFile = async () => {
    if (!movingFile) return;

    try {
      const { error } = await supabase
        .from("creation_files")
        .update({
          category_id: moveTargetCategoryId,
          subcategory_id: moveTargetSubcategoryId,
        })
        .eq("id", movingFile.id);

      if (error) throw error;
      toast.success("Arquivo movido com sucesso!");
      setShowMoveFileDialog(false);
      setMovingFile(null);
      setMoveTargetCategoryId(null);
      setMoveTargetSubcategoryId(null);
      fetchData();
    } catch (error) {
      console.error("Error moving file:", error);
      toast.error("Erro ao mover arquivo");
    }
  };

  const getFilesForSubcategory = (subcategoryId: string) => {
    return files.filter((f) => f.subcategory_id === subcategoryId);
  };

  const getFilesForCategory = (categoryId: string) => {
    return files.filter((f) => f.category_id === categoryId && !f.subcategory_id);
  };

  const getUncategorizedFiles = () => {
    return files.filter((f) => !f.category_id);
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter((s) => s.category_id === categoryId);
  };

  const filteredCategories = categories.filter(
    (c) => c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canPreview = (file: CreationFile) => {
    if (file.is_external_link) return false;
    const previewableTypes = ["image/", "video/", "application/pdf"];
    return previewableTypes.some((t) => file.file_type?.includes(t));
  };

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito ao cargo Criação e Desenvolvedor.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Material Criação</h1>
            <p className="text-muted-foreground">
              Gerencie arquivos e materiais do time de criação
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setEditingCategory(null);
                setCategoryName("");
                setCategoryDescription("");
                setShowCategoryDialog(true);
              }}
              variant="outline"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
            <Button
              onClick={() => {
                setEditingSubcategory(null);
                setSubcategoryName("");
                setSubcategoryDescription("");
                setShowSubcategoryDialog(true);
              }}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Subcategoria
            </Button>
            <Button
              onClick={() => {
                resetFileForm();
                setShowFileDialog(true);
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Arquivo
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar categorias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories and Files */}
        {filteredCategories.length === 0 && files.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nenhum material encontrado. Comece criando uma categoria ou fazendo upload de arquivos.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {filteredCategories.map((category) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="bg-card border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCategory(category)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteItem({ type: "category", item: category });
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {category.description && (
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  )}

                  {/* Files directly in category */}
                  {getFilesForCategory(category.id).map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onPreview={() => openPreview(file)}
                      onEdit={() => openEditFile(file)}
                      onMove={() => openMoveFile(file)}
                      onDelete={() => {
                        setDeleteItem({ type: "file", item: file });
                        setShowDeleteDialog(true);
                      }}
                      canPreview={canPreview(file)}
                    />
                  ))}

                  {/* Subcategories */}
                  {getSubcategoriesForCategory(category.id).map((subcategory) => (
                    <Card key={subcategory.id} className="ml-4">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{subcategory.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditSubcategory(subcategory)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteItem({ type: "subcategory", item: subcategory });
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {subcategory.description && (
                          <CardDescription>{subcategory.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {getFilesForSubcategory(subcategory.id).map((file) => (
                          <FileCard
                            key={file.id}
                            file={file}
                            onPreview={() => openPreview(file)}
                            onEdit={() => openEditFile(file)}
                            onMove={() => openMoveFile(file)}
                            onDelete={() => {
                              setDeleteItem({ type: "file", item: file });
                              setShowDeleteDialog(true);
                            }}
                            canPreview={canPreview(file)}
                          />
                        ))}
                        {getFilesForSubcategory(subcategory.id).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum arquivo nesta subcategoria
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {getFilesForCategory(category.id).length === 0 &&
                    getSubcategoriesForCategory(category.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum arquivo ou subcategoria nesta categoria
                      </p>
                    )}
                </AccordionContent>
              </AccordionItem>
            ))}

            {/* Uncategorized files */}
            {getUncategorizedFiles().length > 0 && (
              <AccordionItem value="uncategorized" className="bg-card border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium">Sem Categoria</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {getUncategorizedFiles().map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onPreview={() => openPreview(file)}
                      onEdit={() => openEditFile(file)}
                      onMove={() => openMoveFile(file)}
                      onDelete={() => {
                        setDeleteItem({ type: "file", item: file });
                        setShowDeleteDialog(true);
                      }}
                      canPreview={canPreview(file)}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Nome da categoria"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Descrição da categoria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}>
              {editingCategory ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={showSubcategoryDialog} onOpenChange={setShowSubcategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? "Editar Subcategoria" : "Nova Subcategoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingSubcategory && (
              <div>
                <Label>Categoria</Label>
                <Select
                  value={selectedCategoryId || ""}
                  onValueChange={setSelectedCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Nome</Label>
              <Input
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                placeholder="Nome da subcategoria"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={subcategoryDescription}
                onChange={(e) => setSubcategoryDescription(e.target.value)}
                placeholder="Descrição da subcategoria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={editingSubcategory ? handleUpdateSubcategory : handleCreateSubcategory}>
              {editingSubcategory ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload de Arquivos</DialogTitle>
            <DialogDescription>
              Arraste arquivos ou clique para selecionar. Suporta múltiplos arquivos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Categoria (opcional)</Label>
              <Select
                value={selectedCategoryId || "none"}
                onValueChange={(v) => {
                  setSelectedCategoryId(v === "none" ? null : v);
                  setSelectedSubcategoryId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCategoryId && (
              <div>
                <Label>Subcategoria (opcional)</Label>
                <Select
                  value={selectedSubcategoryId || "none"}
                  onValueChange={(v) => setSelectedSubcategoryId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem subcategoria</SelectItem>
                    {getSubcategoriesForCategory(selectedCategoryId).map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Button
                variant={isExternalLink ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  setIsExternalLink(false);
                  setUploadingFiles([]);
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
              <Button
                variant={isExternalLink ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsExternalLink(true);
                  setUploadingFiles([]);
                }}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Link Externo
              </Button>
            </div>
            {isExternalLink ? (
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Nome do link"
                  />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <CloudUpload className={cn(
                    "w-10 h-10 mx-auto mb-3",
                    isDragging ? "text-primary" : "text-muted-foreground"
                  )} />
                  <p className="text-sm font-medium">
                    {isDragging ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imagens, Vídeos, PDF, Documentos Office
                  </p>
                  <Input
                    id="file-input"
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                {/* Selected Files List */}
                {uploadingFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>Arquivos selecionados ({uploadingFiles.length})</Label>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {uploadingFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getFileIcon(file.type, false)}
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => removeUploadingFile(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {uploading && uploadProgress > 0 && (
                  <div className="space-y-1">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Enviando... {uploadProgress}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleFileUpload} 
              disabled={uploading || (!isExternalLink && uploadingFiles.length === 0)}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {isExternalLink ? "Adicionar Link" : `Enviar ${uploadingFiles.length > 0 ? `(${uploadingFiles.length})` : ""}`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className={cn(
          "max-h-[95vh] overflow-auto",
          previewFile?.file_type?.includes("pdf") ? "max-w-[95vw] w-full h-[95vh]" : "max-w-4xl"
        )}>
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="flex items-center justify-center flex-1">
              {previewFile.file_type?.includes("image") && (
                <img
                  src={previewFile.file_url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              )}
              {previewFile.file_type?.includes("video") && (
                <video
                  src={previewFile.file_url}
                  controls
                  className="max-w-full max-h-[80vh]"
                />
              )}
              {previewFile.file_type?.includes("pdf") && (
                <iframe
                  src={previewFile.file_url}
                  className="w-full h-[85vh] rounded-md"
                  title={previewFile.name}
                  allowFullScreen
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItem?.type === "category" &&
                "Excluir esta categoria também excluirá todas as suas subcategorias e arquivos."}
              {deleteItem?.type === "subcategory" &&
                "Excluir esta subcategoria também excluirá todos os arquivos dentro dela."}
              {deleteItem?.type === "file" && "Tem certeza que deseja excluir este arquivo?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit File Dialog */}
      <Dialog open={showEditFileDialog} onOpenChange={setShowEditFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Arquivo</DialogTitle>
            <DialogDescription>
              Altere o nome e descrição do arquivo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={editFileName}
                onChange={(e) => setEditFileName(e.target.value)}
                placeholder="Nome do arquivo"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={editFileDescription}
                onChange={(e) => setEditFileDescription(e.target.value)}
                placeholder="Descrição do arquivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditFileDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateFile}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move File Dialog */}
      <Dialog open={showMoveFileDialog} onOpenChange={setShowMoveFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Arquivo</DialogTitle>
            <DialogDescription>
              Selecione a nova categoria e subcategoria para "{movingFile?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Categoria</Label>
              <Select
                value={moveTargetCategoryId || "none"}
                onValueChange={(v) => {
                  setMoveTargetCategoryId(v === "none" ? null : v);
                  setMoveTargetSubcategoryId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {moveTargetCategoryId && (
              <div>
                <Label>Subcategoria (opcional)</Label>
                <Select
                  value={moveTargetSubcategoryId || "none"}
                  onValueChange={(v) => setMoveTargetSubcategoryId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem subcategoria</SelectItem>
                    {getSubcategoriesForCategory(moveTargetCategoryId).map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveFileDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMoveFile}>
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

// File Card Component
interface FileCardProps {
  file: CreationFile;
  onPreview: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  canPreview: boolean;
}

const FileCard: React.FC<FileCardProps> = ({ file, onPreview, onEdit, onMove, onDelete, canPreview }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        {getFileIcon(file.file_type, file.is_external_link)}
        <div>
          <p className="font-medium text-sm">{file.name}</p>
          {file.description && (
            <p className="text-xs text-muted-foreground">{file.description}</p>
          )}
          {file.file_size && (
            <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canPreview && (
          <Button variant="ghost" size="icon" onClick={onPreview}>
            <Eye className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit} title="Renomear">
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onMove} title="Mover">
          <FolderInput className="w-4 h-4" />
        </Button>
        {file.is_external_link ? (
          <Button variant="ghost" size="icon" asChild>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" asChild>
            <a href={file.file_url} download={file.name}>
              <Download className="w-4 h-4" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export default CreationMaterials;
