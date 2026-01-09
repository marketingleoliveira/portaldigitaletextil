import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, ROLE_LABELS } from '@/types/auth';
import RoleBadge from '@/components/RoleBadge';
import { Loader2, Users, Code, Shield, UserCog, User, Palette } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  role?: AppRole;
  region?: string | null;
}

const Team: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);

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
  const vendedores = orgMembers.filter((m) => m.role === 'vendedor');

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
      <Card className="hover:shadow-lg transition-shadow">
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
          {member.role && <RoleBadge role={member.role} region={member.region} size="sm" />}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
              <p className="text-3xl font-bold text-role-vendedor">{vendedores.length}</p>
              <p className="text-sm text-muted-foreground">Vendedores</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Team;
