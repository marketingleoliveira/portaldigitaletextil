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
} from "lucide-react";
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
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit states
  const [editingCategory, setEditingCategory] = useState<CreationCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<CreationSubcategory | null>(null);
  
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

  // File upload
  const handleFileUpload = async () => {
    if (!fileName.trim()) {
      toast.error("Nome do arquivo é obrigatório");
      return;
    }

    if (isExternalLink && !externalUrl.trim()) {
      toast.error("URL é obrigatória para links externos");
      return;
    }

    if (!isExternalLink && !uploadingFile) {
      toast.error("Selecione um arquivo para upload");
      return;
    }

    setUploading(true);
    try {
      let fileUrl = externalUrl;
      let fileType = null;
      let fileSize = null;

      if (!isExternalLink && uploadingFile) {
        const fileExt = uploadingFile.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("creation-files")
          .upload(filePath, uploadingFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("creation-files")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileType = uploadingFile.type;
        fileSize = uploadingFile.size;
      }

      const { error } = await supabase.from("creation_files").insert({
        name: fileName.trim(),
        description: fileDescription.trim() || null,
        file_url: fileUrl,
        file_type: fileType,
        file_size: fileSize,
        category_id: selectedCategoryId || null,
        subcategory_id: selectedSubcategoryId || null,
        is_external_link: isExternalLink,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Arquivo adicionado com sucesso!");
      resetFileForm();
      setShowFileDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao adicionar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const resetFileForm = () => {
    setFileName("");
    setFileDescription("");
    setIsExternalLink(false);
    setExternalUrl("");
    setUploadingFile(null);
    setSelectedCategoryId(null);
    setSelectedSubcategoryId(null);
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

  const openPreview = (file: CreationFile) => {
    setPreviewFile(file);
    setShowPreviewDialog(true);
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Arquivo</DialogTitle>
            <DialogDescription>
              Adicione um novo arquivo ou link externo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Nome do arquivo"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                placeholder="Descrição do arquivo"
              />
            </div>
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
                onClick={() => setIsExternalLink(false)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
              <Button
                variant={isExternalLink ? "default" : "outline"}
                size="sm"
                onClick={() => setIsExternalLink(true)}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Link Externo
              </Button>
            </div>
            {isExternalLink ? (
              <div>
                <Label>URL</Label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
            ) : (
              <div>
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={(e) => setUploadingFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aceita: Imagens, Vídeos, PDF, Documentos Office
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFileDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleFileUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="flex items-center justify-center">
              {previewFile.file_type?.includes("image") && (
                <img
                  src={previewFile.file_url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )}
              {previewFile.file_type?.includes("video") && (
                <video
                  src={previewFile.file_url}
                  controls
                  className="max-w-full max-h-[70vh]"
                />
              )}
              {previewFile.file_type?.includes("pdf") && (
                <iframe
                  src={previewFile.file_url}
                  className="w-full h-[70vh]"
                  title={previewFile.name}
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
    </DashboardLayout>
  );
};

// File Card Component
interface FileCardProps {
  file: CreationFile;
  onPreview: () => void;
  onDelete: () => void;
  canPreview: boolean;
}

const FileCard: React.FC<FileCardProps> = ({ file, onPreview, onDelete, canPreview }) => {
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
