import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Product, Category, AppRole, hasFullAccess } from '@/types/auth';
import RoleBadge from '@/components/RoleBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessLog } from '@/hooks/useAccessLog';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Package, 
  FileText, 
  Download, 
  ExternalLink,
  Tag,
  DollarSign,
  FileSpreadsheet,
  BookOpen,
  Loader2
} from 'lucide-react';

interface ProductWithDetails extends Product {
  category?: Category;
  visibility: AppRole[];
}

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logDownload } = useAccessLog();
  const { toast } = useToast();
  const [product, setProduct] = useState<ProductWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const handleDownloadCatalog = async () => {
    if (!product?.catalog_url) return;

    // Abrir na mesma interação do clique (antes de qualquer await) para não
    // ser bloqueado pelo bloqueador de pop-ups do navegador.
    window.open(product.catalog_url, '_blank');
    void logDownload('catalog', product.id);
    toast({
      title: 'Download iniciado',
      description: 'Baixando catálogo do produto',
    });
  };

  const handleDownloadTechnicalSheet = async () => {
    if (!product?.technical_sheet_url) return;

    window.open(product.technical_sheet_url, '_blank');
    void logDownload('technical_sheet', product.id);

    toast({
      title: 'Download iniciado',
      description: 'Baixando ficha técnica',
    });
  };

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  const fetchProduct = async (productId: string) => {
    try {
      const { data: productData, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', productId)
        .maybeSingle();

      if (error) throw error;

      if (productData) {
        // Fetch visibility
        const { data: visibilityData } = await supabase
          .from('product_visibility')
          .select('visible_to_role')
          .eq('product_id', productData.id);

        setProduct({
          ...productData,
          visibility: (visibilityData || []).map((v) => v.visible_to_role as AppRole),
        });
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (!price) return 'Sob consulta';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!product) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <Button variant="ghost" onClick={() => navigate('/produtos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Catálogo
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Produto não encontrado</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/produtos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Image & Basic Info */}
            <Card className="overflow-hidden">
              {product.image_url ? (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <Package className="w-24 h-24 text-muted-foreground/50" />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{product.name}</CardTitle>
                    {product.category && (
                      <Badge variant="secondary" className="mt-2">
                        <Tag className="w-3 h-3 mr-1" />
                        {product.category.name}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {product.description ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {product.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Sem descrição disponível</p>
                )}
              </CardContent>
            </Card>

            {/* Commercial Conditions */}
            {product.commercial_conditions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Condições Comerciais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {product.commercial_conditions}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-primary" />
                  Documentos
                </CardTitle>
                <CardDescription>
                  Materiais de apoio disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.catalog_url ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={handleDownloadCatalog}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Catálogo do Produto
                    <Download className="w-3 h-3 ml-auto" />
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full justify-start" disabled>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Catálogo não disponível
                  </Button>
                )}

                {product.technical_sheet_url ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={handleDownloadTechnicalSheet}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Ficha Técnica
                    <Download className="w-3 h-3 ml-auto" />
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full justify-start" disabled>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Ficha Técnica não disponível
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Categoria</p>
                  <p className="font-medium">{product.category?.name || 'Sem categoria'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Cadastrado em</p>
                  <p className="font-medium">{formatDate(product.created_at)}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Última atualização</p>
                  <p className="font-medium">{formatDate(product.updated_at)}</p>
                </div>

                {/* Visibility - Admin only */}
                {hasFullAccess(user?.role) && product.visibility.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Visível para</p>
                      <div className="flex flex-wrap gap-1">
                        {product.visibility.map((role) => (
                          <RoleBadge key={role} role={role} size="sm" />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProductDetails;
