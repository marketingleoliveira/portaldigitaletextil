import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, ROLE_LABELS } from '@/types/auth';
import RoleBadge from '@/components/RoleBadge';
import { Loader2, Users, Code, Shield, UserCog, User, Palette, Mail, X, Linkedin, Megaphone, Target } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  role?: AppRole;
  region?: string | null;
  phone?: string | null;
  custom_image_url?: string | null;
  linkedin?: string | null;
}

const Team: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const membersWithRoles = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          is_active: profile.is_active,
          role: userRole?.role as AppRole | undefined,
          region: profile.region,
          phone: profile.phone,
          custom_image_url: profile.custom_image_url,
          linkedin: profile.linkedin,
        };
      });

      setMembers(membersWithRoles);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  // Separate DEV from org chart
  const devMembers = members.filter((m) => m.role === 'dev');
  const orgMembers = members.filter((m) => m.role !== 'dev');

  // Group by role for org chart
  const admins = orgMembers.filter((m) => m.role === 'admin');
  const gerentes = orgMembers.filter((m) => m.role === 'gerente');
  const criacao = orgMembers.filter((m) => m.role === 'criacao');
  const marketing = orgMembers.filter((m) => m.role === 'marketing');
  const sdrs = orgMembers.filter((m) => m.role === 'sdr');
  const vendedores = orgMembers.filter((m) => m.role === 'vendedor');
  const qualidade = orgMembers.filter((m) => m.role === 'qualidade');

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setDialogOpen(true);
  };

  const formatWhatsappLink = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const fullNumber = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${fullNumber}`;
  };

  const MemberCard: React.FC<{ member: TeamMember; size?: 'sm' | 'md' | 'lg' }> = ({ 
    member, 
    size = 'md' 
  }) => {
    const sizeClasses = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };
    const avatarSizes = {
      sm: 'w-10 h-10',
      md: 'w-14 h-14',
      lg: 'w-20 h-20',
    };
    const textSizes = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    };

    return (
      <Card 
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => handleMemberClick(member)}
      >
        <CardContent className={`${sizeClasses[size]} flex flex-col items-center text-center`}>
          <Avatar className={`${avatarSizes[size]} mb-3`}>
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className={textSizes[size]}>
              {member.full_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h3 className={`font-semibold ${textSizes[size]} line-clamp-1`}>
            {member.full_name}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-1 mb-2">
            {member.email}
          </p>
          <div className="flex items-center gap-1 mb-2">
            {member.role && <RoleBadge role={member.role} region={member.region} size="sm" />}
            {member.phone && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(formatWhatsappLink(member.phone!), '_blank');
                }}
                title="Abrir conversa no WhatsApp"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
              </Button>
            )}
            {member.linkedin && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-[#0A66C2] hover:text-[#004182] hover:bg-blue-100"
                onClick={(e) => {
                  e.stopPropagation();
                  let url = member.linkedin!;
                  if (!url.startsWith('http')) {
                    url = `https://linkedin.com/in/${url}`;
                  }
                  window.open(url, '_blank');
                }}
                title="Abrir perfil no LinkedIn"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
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

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-muted-foreground">Organograma e membros da equipe</p>
        </div>

        {/* DEV Section - Separate */}
        {devMembers.length > 0 && (
          <Card className="border-role-dev/30 bg-gradient-to-r from-role-dev/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-role-dev" />
                Desenvolvimento
              </CardTitle>
              <CardDescription>
                Equipe de desenvolvimento e suporte técnico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {devMembers.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Org Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Organograma
            </CardTitle>
            <CardDescription>
              Estrutura hierárquica da equipe comercial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Diretores - Top Level */}
            {admins.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-role-admin" />
                  <h3 className="font-semibold text-lg">Diretoria</h3>
                  <Badge variant="secondary" className="ml-2">{admins.length}</Badge>
                </div>
                <div className="flex justify-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl">
                    {admins.map((member) => (
                      <MemberCard key={member.id} member={member} size="lg" />
                    ))}
                  </div>
                </div>
                
                {/* Connector Line */}
                {(gerentes.length > 0 || criacao.length > 0 || vendedores.length > 0) && (
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>
            )}

            {/* Gerentes - Middle Level */}
            {gerentes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-role-gerente" />
                  <h3 className="font-semibold text-lg">Gerência</h3>
                  <Badge variant="secondary" className="ml-2">{gerentes.length}</Badge>
                </div>
                <div className="flex justify-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl">
                    {gerentes.map((member) => (
                      <MemberCard key={member.id} member={member} />
                    ))}
                  </div>
                </div>

                {/* Connector Line */}
                {(criacao.length > 0 || marketing.length > 0 || sdrs.length > 0 || vendedores.length > 0) && (
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>
            )}

            {/* Marketing */}
            {marketing.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-role-marketing" />
                  <h3 className="font-semibold text-lg">Marketing</h3>
                  <Badge variant="secondary" className="ml-2">{marketing.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {marketing.map((member) => (
                    <MemberCard key={member.id} member={member} size="sm" />
                  ))}
                </div>
                {(criacao.length > 0 || sdrs.length > 0 || vendedores.length > 0) && (
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>
            )}

            {/* SDR - Prospecção de Leads */}
            {sdrs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-role-sdr" />
                  <h3 className="font-semibold text-lg">SDR — Prospecção de Leads</h3>
                  <Badge variant="secondary" className="ml-2">{sdrs.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sdrs.map((member) => (
                    <MemberCard key={member.id} member={member} size="sm" />
                  ))}
                </div>
                {(criacao.length > 0 || vendedores.length > 0) && (
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>
            )}


            {/* Criação - Above Vendedores */}
            {criacao.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-role-criacao" />
                  <h3 className="font-semibold text-lg">Criação</h3>
                  <Badge variant="secondary" className="ml-2">{criacao.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {criacao.map((member) => (
                    <MemberCard key={member.id} member={member} size="sm" />
                  ))}
                </div>

                {/* Connector Line */}
                {vendedores.length > 0 && (
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>
            )}

            {/* Vendedores - Bottom Level */}
            {vendedores.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-role-vendedor" />
                  <h3 className="font-semibold text-lg">Equipe Comercial</h3>
                  <Badge variant="secondary" className="ml-2">{vendedores.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {vendedores.map((member) => (
                    <MemberCard key={member.id} member={member} size="sm" />
                  ))}
                </div>
              </div>
            )}

            {/* No members message */}
            {orgMembers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum membro encontrado no organograma</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{members.length}</p>
              <p className="text-sm text-muted-foreground">Total de Membros</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-role-admin">{admins.length}</p>
              <p className="text-sm text-muted-foreground">Diretores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-role-gerente">{gerentes.length}</p>
              <p className="text-sm text-muted-foreground">Gerentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-role-criacao">{criacao.length}</p>
              <p className="text-sm text-muted-foreground">Criação</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-role-marketing">{marketing.length}</p>
              <p className="text-sm text-muted-foreground">Marketing</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-role-sdr">{sdrs.length}</p>
              <p className="text-sm text-muted-foreground">SDR</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-role-vendedor">{vendedores.length}</p>
              <p className="text-sm text-muted-foreground">Vendedores</p>
            </CardContent>
          </Card>
        </div>

        {/* Member Profile Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">Perfil do Membro</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={selectedMember.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {selectedMember.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center">
                  <h3 className="text-xl font-semibold">{selectedMember.full_name}</h3>
                  {selectedMember.role && (
                    <div className="mt-2">
                      <RoleBadge role={selectedMember.role} region={selectedMember.region} />
                    </div>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-sm">{selectedMember.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <WhatsAppIcon className="w-4 h-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <p className="font-medium text-sm">{selectedMember.phone || 'Não informado'}</p>
                    </div>
                    {selectedMember.phone && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => window.open(formatWhatsappLink(selectedMember.phone!), '_blank')}
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

                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">LinkedIn</p>
                      <p className="font-medium text-sm">{selectedMember.linkedin || 'Não informado'}</p>
                    </div>
                    {selectedMember.linkedin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-[#0A66C2] hover:text-[#004182] hover:bg-blue-100"
                        onClick={() => {
                          let url = selectedMember.linkedin!;
                          if (!url.startsWith('http')) {
                            url = `https://linkedin.com/in/${url}`;
                          }
                          window.open(url, '_blank');
                        }}
                        title="Abrir perfil no LinkedIn"
                      >
                        <Linkedin className="w-5 h-5" />
                      </Button>
                    )}
                  </div>

                  {/* Custom Image for criacao role */}
                  {selectedMember.role === 'criacao' && selectedMember.custom_image_url && (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2 text-center">Imagem Personalizada</p>
                      <img 
                        src={selectedMember.custom_image_url} 
                        alt="Imagem personalizada"
                        className="w-full rounded-lg object-cover max-h-48"
                      />
                    </div>
                  )}
                </div>

                <Button 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => setDialogOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Team;
