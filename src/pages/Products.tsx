import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Product, Category, AppRole, isManagerOrAbove } from '@/types/auth';
import RoleBadge from '@/components/RoleBadge';
import { Search, Package, FileText, Download, Plus, Filter, Eye, Pencil, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProductWithDetails extends Product {
  category?: Category;
  visibility: AppRole[];
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  commercial_conditions: string;
  image_url: string;
  catalog_url: string;
  technical_sheet_url: string;
  category_id: string;
  visibility: AppRole[];
}

interface ProductFormProps {
  formProduct: ProductFormData;
  setFormProduct: React.Dispatch<React.SetStateAction<ProductFormData>>;
  categories: Category[];
  idPrefix?: string;
}

const ProductForm: React.FC<ProductFormProps> = ({ formProduct, setFormProduct, categories, idPrefix = '' }) => (
  <div className="grid gap-4 py-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}name`}>Nome *</Label>
        <Input
          id={`${idPrefix}name`}
          value={formProduct.name}
          onChange={(e) => setFormProduct({ ...formProduct, name: e.target.value })}
          placeholder="Nome do produto"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}price`}>Preço</Label>
        <Input
          id={`${idPrefix}price`}
          type="number"
          step="0.01"
          value={formProduct.price}
          onChange={(e) => setFormProduct({ ...formProduct, price: e.target.value })}
          placeholder="0.00"
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}description`}>Descrição</Label>
      <Textarea
        id={`${idPrefix}description`}
        value={formProduct.description}
        onChange={(e) => setFormProduct({ ...formProduct, description: e.target.value })}
        placeholder="Descrição do produto"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}category`}>Categoria</Label>
      <Select
        value={formProduct.category_id}
        onValueChange={(value) => setFormProduct({ ...formProduct, category_id: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma categoria" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}commercial`}>Condições Comerciais</Label>
      <Textarea
        id={`${idPrefix}commercial`}
        value={formProduct.commercial_conditions}
        onChange={(e) => setFormProduct({ ...formProduct, commercial_conditions: e.target.value })}
        placeholder="Condições comerciais e observações"
      />
    </div>
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}image_url`}>URL da Imagem</Label>
        <Input
          id={`${idPrefix}image_url`}
          value={formProduct.image_url}
          onChange={(e) => setFormProduct({ ...formProduct, image_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}catalog_url`}>URL do Catálogo</Label>
        <Input
          id={`${idPrefix}catalog_url`}
          value={formProduct.catalog_url}
          onChange={(e) => setFormProduct({ ...formProduct, catalog_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}technical_sheet_url`}>Ficha Técnica</Label>
        <Input
          id={`${idPrefix}technical_sheet_url`}
          value={formProduct.technical_sheet_url}
          onChange={(e) => setFormProduct({ ...formProduct, technical_sheet_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label>Visibilidade por Cargo</Label>
      <div className="flex flex-wrap gap-4 pt-2">
        {(['vendedor', 'gerente', 'admin', 'diretoria'] as AppRole[]).map((role) => (
          <div key={role} className="flex items-center space-x-2">
            <Checkbox
              id={`${idPrefix}visibility-${role}`}
              checked={formProduct.visibility.includes(role)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setFormProduct({
                    ...formProduct,
                    visibility: [...formProduct.visibility, role],
                  });
                } else {
                  setFormProduct({
                    ...formProduct,
                    visibility: formProduct.visibility.filter((r) => r !== role),
                  });
                }
              }}
            />
            <Label htmlFor={`${idPrefix}visibility-${role}`} className="cursor-pointer">
              <RoleBadge role={role} size="sm" />
            </Label>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Products: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<ProductWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state for new/edit product
  const [formProduct, setFormProduct] = useState({
    name: '',
    description: '',
    price: '',
    commercial_conditions: '',
    image_url: '',
    catalog_url: '',
    technical_sheet_url: '',
    category_id: '',
    visibility: ['vendedor', 'gerente', 'admin', 'diretoria'] as AppRole[],
  });

  const canManageProducts = isManagerOrAbove(user?.role);

  const resetForm = () => {
    setFormProduct({
      name: '',
      description: '',
      price: '',
      commercial_conditions: '',
      image_url: '',
      catalog_url: '',
      technical_sheet_url: '',
      category_id: '',
      visibility: ['vendedor', 'gerente', 'admin', 'diretoria'],
    });
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch visibility for each product
      const productsWithVisibility = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: visibilityData } = await supabase
            .from('product_visibility')
            .select('visible_to_role')
            .eq('product_id', product.id);

          return {
            ...product,
            visibility: (visibilityData || []).map((v) => v.visible_to_role as AppRole),
          };
        })
      );

      setProducts(productsWithVisibility);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    setCategories(data || []);
  };

  const handleCreateProduct = async () => {
    if (!formProduct.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do produto é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          name: formProduct.name,
          description: formProduct.description || null,
          price: formProduct.price ? parseFloat(formProduct.price) : null,
          commercial_conditions: formProduct.commercial_conditions || null,
          image_url: formProduct.image_url || null,
          catalog_url: formProduct.catalog_url || null,
          technical_sheet_url: formProduct.technical_sheet_url || null,
          category_id: formProduct.category_id || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (productError) throw productError;

      if (productData && formProduct.visibility.length > 0) {
        const visibilityEntries = formProduct.visibility.map((role) => ({
          product_id: productData.id,
          visible_to_role: role,
        }));
        await supabase.from('product_visibility').insert(visibilityEntries);
      }

      toast({
        title: 'Sucesso',
        description: 'Produto cadastrado com sucesso',
      });

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao cadastrar produto',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = (product: ProductWithDetails) => {
    setEditingProduct(product);
    setFormProduct({
      name: product.name,
      description: product.description || '',
      price: product.price?.toString() || '',
      commercial_conditions: product.commercial_conditions || '',
      image_url: product.image_url || '',
      catalog_url: product.catalog_url || '',
      technical_sheet_url: product.technical_sheet_url || '',
      category_id: product.category_id || '',
      visibility: product.visibility,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!formProduct.name.trim() || !editingProduct) {
      toast({
        title: 'Erro',
        description: 'Nome do produto é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: formProduct.name,
          description: formProduct.description || null,
          price: formProduct.price ? parseFloat(formProduct.price) : null,
          commercial_conditions: formProduct.commercial_conditions || null,
          image_url: formProduct.image_url || null,
          catalog_url: formProduct.catalog_url || null,
          technical_sheet_url: formProduct.technical_sheet_url || null,
          category_id: formProduct.category_id || null,
        })
        .eq('id', editingProduct.id);

      if (updateError) throw updateError;

      // Update visibility - delete existing and insert new
      await supabase
        .from('product_visibility')
        .delete()
        .eq('product_id', editingProduct.id);

      if (formProduct.visibility.length > 0) {
        const visibilityEntries = formProduct.visibility.map((role) => ({
          product_id: editingProduct.id,
          visible_to_role: role,
        }));
        await supabase.from('product_visibility').insert(visibilityEntries);
      }

      toast({
        title: 'Sucesso',
        description: 'Produto atualizado com sucesso',
      });

      setEditDialogOpen(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar produto',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;

    setDeleting(true);

    try {
      // Delete visibility entries first
      await supabase
        .from('product_visibility')
        .delete()
        .eq('product_id', deletingProduct.id);

      // Delete product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deletingProduct.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Produto excluído com sucesso',
      });

      setDeleteDialogOpen(false);
      setDeletingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir produto',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (price: number | null) => {
    if (!price) return 'Sob consulta';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">
              {canManageProducts 
                ? 'Gerencie o catálogo de produtos' 
                : 'Catálogo de produtos disponíveis'}
            </p>
          </div>
          {canManageProducts && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="shadow-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Produto</DialogTitle>
                  <DialogDescription>
                    Preencha as informações do novo produto
                  </DialogDescription>
                </DialogHeader>
                <ProductForm 
                  formProduct={formProduct}
                  setFormProduct={setFormProduct}
                  categories={categories}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateProduct} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Cadastrar'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Edit Product Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Produto</DialogTitle>
              <DialogDescription>
                Atualize as informações do produto
              </DialogDescription>
            </DialogHeader>
            <ProductForm 
              formProduct={formProduct}
              setFormProduct={setFormProduct}
              categories={categories}
              idPrefix="edit-"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateProduct} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Product Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o produto "{deletingProduct?.name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingProduct(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum produto encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {product.image_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <Package className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                    {product.category && (
                      <Badge variant="secondary" className="shrink-0">
                        {product.category.name}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {product.description || 'Sem descrição'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-xl font-bold text-primary">
                    {formatPrice(product.price)}
                  </p>
                  {canManageProducts && product.visibility.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.visibility.map((role) => (
                        <RoleBadge key={role} role={role} size="sm" showIcon={false} />
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/produtos/${product.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Detalhes
                  </Button>
                  {canManageProducts && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingProduct(product);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {(product.catalog_url || product.technical_sheet_url) && (
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Products;
