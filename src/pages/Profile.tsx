import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RoleBadge from '@/components/RoleBadge';
import ProfileCertificates from '@/components/ProfileCertificates';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Lock, Mail, Loader2, Pencil, Check, X, Camera, MessageCircle, Linkedin } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const nameSchema = z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo');

const whatsappSchema = z.string()
  .regex(/^[\d\s()+-]*$/, 'Formato de WhatsApp inválido')
  .optional()
  .or(z.literal(''));

// Format phone number to Brazilian format (XX) XXXXX-XXXX
const formatWhatsappNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 11 digits (2 DDD + 9 phone)
  const limitedDigits = digits.slice(0, 11);
  
  // Apply mask based on number of digits
  if (limitedDigits.length === 0) return '';
  if (limitedDigits.length <= 2) return `(${limitedDigits}`;
  if (limitedDigits.length <= 7) return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
  return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`;
};

const Profile: React.FC = () => {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.profile?.full_name || '');
  const [savingName, setSavingName] = useState(false);

  // WhatsApp editing state
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false);
  const [editedWhatsapp, setEditedWhatsapp] = useState(user?.profile?.phone || '');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  // LinkedIn editing state
  const [isEditingLinkedin, setIsEditingLinkedin] = useState(false);
  const [editedLinkedin, setEditedLinkedin] = useState(user?.profile?.linkedin || '');
  const [savingLinkedin, setSavingLinkedin] = useState(false);

  // Avatar state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Erro',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Senha atualizada com sucesso',
      });

      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar senha',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateName = async () => {
    const validation = nameSchema.safeParse(editedName.trim());
    if (!validation.success) {
      toast({
        title: 'Erro',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editedName.trim() })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Nome atualizado com sucesso',
      });

      setIsEditingName(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar nome',
        variant: 'destructive',
      });
    } finally {
      setSavingName(false);
    }
  };

  const cancelNameEdit = () => {
    setEditedName(user?.profile?.full_name || '');
    setIsEditingName(false);
  };

  const handleUpdateWhatsapp = async () => {
    const validation = whatsappSchema.safeParse(editedWhatsapp.trim());
    if (!validation.success) {
      toast({
        title: 'Erro',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setSavingWhatsapp(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: editedWhatsapp.trim() })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'WhatsApp atualizado com sucesso',
      });

      setIsEditingWhatsapp(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const cancelWhatsappEdit = () => {
    setEditedWhatsapp(user?.profile?.phone || '');
    setIsEditingWhatsapp(false);
  };

  const formatWhatsappLink = (phone: string) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // If doesn't start with country code, assume Brazil (+55)
    const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${fullNumber}`;
  };

  const handleUpdateLinkedin = async () => {
    setSavingLinkedin(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ linkedin: editedLinkedin.trim() || null })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'LinkedIn atualizado com sucesso',
      });

      setIsEditingLinkedin(false);
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar LinkedIn',
        variant: 'destructive',
      });
    } finally {
      setSavingLinkedin(false);
    }
  };

  const cancelLinkedinEdit = () => {
    setEditedLinkedin(user?.profile?.linkedin || '');
    setIsEditingLinkedin(false);
  };

  const formatLinkedinUrl = (linkedin: string) => {
    // If it's already a full URL, return it
    if (linkedin.startsWith('http://') || linkedin.startsWith('https://')) {
      return linkedin;
    }
    // If it starts with linkedin.com, add https://
    if (linkedin.startsWith('linkedin.com')) {
      return `https://${linkedin}`;
    }
    // Otherwise, assume it's a username and create the URL
    return `https://linkedin.com/in/${linkedin.replace('@', '')}`;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida',
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

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Sucesso',
        description: 'Foto atualizada com sucesso',
      });

      window.location.reload();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer upload da foto',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const avatarUrl = user?.profile?.avatar_url;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">Visualize e edite suas informações</p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                    {(isEditingName ? editedName : user?.profile?.full_name)?.charAt(0) || 'U'}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="max-w-xs"
                      placeholder="Seu nome"
                      maxLength={100}
                      disabled={savingName}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleUpdateName}
                      disabled={savingName}
                    >
                      {savingName ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={cancelNameEdit}
                      disabled={savingName}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{user?.profile?.full_name || 'Usuário'}</p>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => {
                        setEditedName(user?.profile?.full_name || '');
                        setIsEditingName(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                {user?.role && <RoleBadge role={user.role} />}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Clique na foto para alterar (máximo 2MB)
            </p>

            <div className="grid gap-4 pt-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  {isEditingWhatsapp ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={editedWhatsapp}
                        onChange={(e) => setEditedWhatsapp(formatWhatsappNumber(e.target.value))}
                        className="max-w-xs h-8"
                        placeholder="(11) 99999-9999"
                        disabled={savingWhatsapp}
                        maxLength={16}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={handleUpdateWhatsapp}
                        disabled={savingWhatsapp}
                      >
                        {savingWhatsapp ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={cancelWhatsappEdit}
                        disabled={savingWhatsapp}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user?.profile?.phone || 'Não informado'}</p>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => {
                          setEditedWhatsapp(user?.profile?.phone || '');
                          setIsEditingWhatsapp(true);
                        }}
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
                {user?.profile?.phone && !isEditingWhatsapp && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={() => window.open(formatWhatsappLink(user.profile.phone!), '_blank')}
                    title="Abrir conversa no WhatsApp"
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      className="w-5 h-5 fill-current"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </Button>
                )}
              </div>

              {/* LinkedIn Field */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Linkedin className="w-4 h-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">LinkedIn</p>
                  {isEditingLinkedin ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={editedLinkedin}
                        onChange={(e) => setEditedLinkedin(e.target.value)}
                        className="max-w-xs h-8"
                        placeholder="linkedin.com/in/seu-perfil"
                        disabled={savingLinkedin}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={handleUpdateLinkedin}
                        disabled={savingLinkedin}
                      >
                        {savingLinkedin ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={cancelLinkedinEdit}
                        disabled={savingLinkedin}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user?.profile?.linkedin || 'Não informado'}</p>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => {
                          setEditedLinkedin(user?.profile?.linkedin || '');
                          setIsEditingLinkedin(true);
                        }}
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
                {user?.profile?.linkedin && !isEditingLinkedin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                    onClick={() => window.open(formatLinkedinUrl(user.profile.linkedin!), '_blank')}
                    title="Abrir perfil no LinkedIn"
                  >
                    <Linkedin className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificates */}
        <ProfileCertificates />

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Alterar Senha
            </CardTitle>
            <CardDescription>Mantenha sua conta segura</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  maxLength={72}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Atualizar Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Profile;