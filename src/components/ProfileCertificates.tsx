import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Trophy, Calendar, Target, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MeritCertificate from './MeritCertificate';
import { useToast } from '@/hooks/use-toast';

interface Certificate {
  id: string;
  goal_id: string;
  goal_title: string;
  goal_value: string;
  period_type: string;
  achieved_at: string;
}

const periodLabels: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export default function ProfileCertificates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCriacaoRole = user?.role === 'criacao';

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        if (isCriacaoRole) {
          // Fetch custom image for criacao role
          const { data: profile } = await supabase
            .from('profiles')
            .select('custom_image_url')
            .eq('id', user.id)
            .maybeSingle();
          
          setCustomImageUrl(profile?.custom_image_url || null);
        } else {
          // Fetch certificates for other roles
          const { data, error } = await supabase
            .from('achieved_certificates')
            .select('*')
            .eq('user_id', user.id)
            .order('achieved_at', { ascending: false });

          if (error) throw error;
          setCertificates(data || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id, isCriacaoRole]);

  const handleViewCertificate = (cert: Certificate) => {
    setSelectedCertificate(cert);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type - JPEG only
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem JPEG',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingImage(true);

    try {
      const filePath = `${user.id}/custom-image.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const imageUrl = `${publicUrl}?t=${Date.now()}`;

      // Update profile with custom image URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ custom_image_url: imageUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setCustomImageUrl(imageUrl);
      toast({
        title: 'Sucesso',
        description: 'Imagem personalizada atualizada!',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer upload da imagem',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user?.id) return;

    setUploadingImage(true);

    try {
      // Remove from storage
      await supabase.storage
        .from('avatars')
        .remove([`${user.id}/custom-image.jpg`]);

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ custom_image_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setCustomImageUrl(null);
      toast({
        title: 'Sucesso',
        description: 'Imagem removida com sucesso',
      });
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao remover imagem',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isCriacaoRole ? (
              <>
                <ImagePlus className="w-5 h-5 text-role-criacao" />
                Minha Imagem Personalizada
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5 text-yellow-500" />
                Meus Certificados
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Criacao role - Custom image upload
  if (isCriacaoRole) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-role-criacao" />
            Minha Imagem Personalizada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground font-medium">
              CUSTOMIZE SEU PERFIL COM O JPEG QUE QUISER
            </p>
            
            {customImageUrl ? (
              <div className="space-y-4">
                <img 
                  src={customImageUrl} 
                  alt="Imagem personalizada"
                  className="w-full max-w-sm mx-auto rounded-lg object-cover shadow-lg"
                />
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ImagePlus className="w-4 h-4 mr-2" />
                    )}
                    Trocar Imagem
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRemoveImage}
                    disabled={uploadingImage}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-role-criacao/30 rounded-lg p-8 cursor-pointer hover:border-role-criacao/60 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? (
                  <Loader2 className="w-12 h-12 mx-auto text-role-criacao animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-12 h-12 mx-auto text-role-criacao/50 mb-3" />
                    <p className="text-muted-foreground">
                      Clique para adicionar sua imagem JPEG
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo 2MB
                    </p>
                  </>
                )}
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Other roles - Certificates
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Meus Certificados
            {certificates.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                {certificates.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Você ainda não conquistou nenhum certificado.</p>
              <p className="text-sm mt-1">Bata suas metas para ganhar certificados de honra ao mérito!</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent rounded-lg border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{cert.goal_title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {cert.goal_value}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(cert.achieved_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </span>
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                          {periodLabels[cert.period_type] || cert.period_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewCertificate(cert)}
                    className="gap-1.5 text-xs bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30 hover:border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCertificate && (
        <MeritCertificate
          isOpen={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedCertificate(null);
          }}
          sellerName={user?.profile?.full_name || 'Vendedor'}
          goalTitle={selectedCertificate.goal_title}
          goalValue={selectedCertificate.goal_value}
          achievedDate={new Date(selectedCertificate.achieved_at)}
          periodType={selectedCertificate.period_type}
        />
      )}
    </>
  );
}
