import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasFullAccess } from '@/types/auth';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  FolderOpen, 
  Activity, 
  TrendingUp, 
  FileText, 
  Bell,
  HelpCircle,
  TicketIcon,
  ArrowRight,
  Link2,
  ExternalLink,
  Palette,
  Image,
  Video,
  FileSpreadsheet,
  File,
  Presentation,
  Music,
  Archive,
  Link as LinkIcon
} from 'lucide-react';
import RoleBadge from '@/components/RoleBadge';
import OnlineUsersCard from '@/components/OnlineUsersCard';
import ActivityRankingCard from '@/components/ActivityRankingCard';

interface FileTypeStats {
  pdf: number;
  word: number;
  excel: number;
  powerpoint: number;
  image: number;
  video: number;
  audio: number;
  zip: number;
  link: number;
}

interface DashboardStats {
  totalProducts: number;
  totalUsers: number;
  totalCategories: number;
  recentLogs: number;
  totalFiles: number;
  unreadNotifications: number;
  openTickets: number;
  totalCreationFiles: number;
  filesBreakdown: FileTypeStats;
  creationFilesBreakdown: FileTypeStats;
}

interface LinkFile {
  id: string;
  name: string;
  file_url: string;
  description: string | null;
}

interface RecentNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: 'group' | 'individual';
}

const getFileTypeFromName = (fileName: string, isExternalLink?: boolean): keyof FileTypeStats | null => {
  if (isExternalLink) return 'link';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
  if (['ppt', 'pptx'].includes(ext)) return 'powerpoint';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  return null;
};

const emptyBreakdown = (): FileTypeStats => ({ 
  pdf: 0, word: 0, excel: 0, powerpoint: 0, image: 0, video: 0, audio: 0, zip: 0, link: 0 
});

const calculateFileBreakdown = (files: { name: string; is_external_link?: boolean }[]): FileTypeStats => {
  const breakdown = emptyBreakdown();
  files.forEach(file => {
    const type = getFileTypeFromName(file.name, file.is_external_link);
    if (type) breakdown[type]++;
  });
  return breakdown;
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalUsers: 0,
    totalCategories: 0,
    recentLogs: 0,
    totalFiles: 0,
    unreadNotifications: 0,
    openTickets: 0,
    totalCreationFiles: 0,
    filesBreakdown: emptyBreakdown(),
    creationFilesBreakdown: emptyBreakdown(),
  });
  const [linkFiles, setLinkFiles] = useState<LinkFile[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        const { count: categoriesCount } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true });

        const { data: filesData, count: filesCount } = await supabase
          .from('files')
          .select('name, is_external_link', { count: 'exact' });
        
        const filesBreakdown = calculateFileBreakdown(filesData || []);

        const { count: ticketsCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aberto');

        let creationFilesCount = 0;
        let creationFilesBreakdown: FileTypeStats = emptyBreakdown();
        if (user?.role === 'criacao' || user?.role === 'dev') {
          const { data: creationData, count: creationCount } = await supabase
            .from('creation_files')
            .select('name', { count: 'exact' });
          creationFilesCount = creationCount || 0;
          creationFilesBreakdown = calculateFileBreakdown(creationData || []);
        }

        let usersCount = 0;
        let logsCount = 0;

        if (hasFullAccess(user?.role)) {
          const { count: users } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          usersCount = users || 0;

          const { count: logs } = await supabase
            .from('access_logs')
            .select('*', { count: 'exact', head: true });
          logsCount = logs || 0;
        }

        const { data: linksData } = await supabase
          .from('files')
          .select('id, name, file_url, description')
          .eq('category', 'Links de Acesso')
          .eq('is_external_link', true)
          .order('name', { ascending: true });

        setLinkFiles(linksData || []);

        // Fetch recent notifications for current user
        const allNotifs: RecentNotification[] = [];

        // Group notifications (by role)
        if (user?.role) {
          const { data: groupNotifs } = await supabase
            .from('notifications')
            .select('id, title, message, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (groupNotifs) {
            allNotifs.push(...groupNotifs.map(n => ({ ...n, type: 'group' as const })));
          }
        }

        // Individual notifications
        if (user?.id) {
          const { data: userNotifs } = await supabase
            .from('user_notifications')
            .select('id, title, message, created_at')
            .eq('target_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (userNotifs) {
            allNotifs.push(...userNotifs.map(n => ({ ...n, type: 'individual' as const })));
          }
        }

        // Sort by date and take latest 6
        allNotifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentNotifications(allNotifs.slice(0, 6));

        setStats({
          totalProducts: productsCount || 0,
          totalUsers: usersCount,
          totalCategories: categoriesCount || 0,
          recentLogs: logsCount,
          totalFiles: filesCount || 0,
          unreadNotifications: 0,
          openTickets: ticketsCount || 0,
          totalCreationFiles: creationFilesCount,
          filesBreakdown,
          creationFilesBreakdown,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.role]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const statsCards = [
    {
      title: 'Categorias',
      value: stats.totalCategories,
      icon: FolderOpen,
      description: 'Organizando arquivos',
      color: 'text-success',
      bgColor: 'bg-success/10',
      href: '/categorias',
      roles: ['dev', 'admin', 'gerente'],
    },
    {
      title: 'Material Comercial',
      value: stats.totalFiles,
      icon: FileText,
      description: 'Materiais disponíveis',
      color: 'text-role-gerente',
      bgColor: 'bg-role-gerente/10',
      href: '/downloads',
      roles: ['dev', 'admin', 'gerente', 'vendedor', 'criacao'],
      breakdown: stats.filesBreakdown,
    },
    {
      title: 'Material Criação',
      value: stats.totalCreationFiles,
      icon: Palette,
      description: 'Recursos criativos',
      color: 'text-role-criacao',
      bgColor: 'bg-role-criacao/10',
      href: '/material-criacao',
      roles: ['dev', 'criacao'],
      breakdown: stats.creationFilesBreakdown,
    },
    {
      title: 'Usuários',
      value: stats.totalUsers,
      icon: Users,
      description: 'Ativos no sistema',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      href: '/usuarios',
      roles: ['dev', 'admin'],
    },
    {
      title: 'Acessos',
      value: stats.recentLogs,
      icon: Activity,
      description: 'Logs registrados',
      color: 'text-role-admin',
      bgColor: 'bg-role-admin/10',
      href: '/relatorios',
      roles: ['dev', 'admin'],
    },
  ];

  const filteredStats = statsCards.filter(card => 
    user?.role && (card.roles.includes(user.role) || user.role === 'dev')
  );

  const quickActions = [
    {
      title: 'Materiais Comerciais',
      description: 'Fichas técnicas e catálogos',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      href: '/downloads',
      roles: ['dev', 'admin', 'gerente', 'vendedor', 'criacao'],
    },
    {
      title: 'Materiais de Criação',
      description: 'Arquivos e recursos criativos',
      icon: Palette,
      color: 'text-role-criacao',
      bgColor: 'bg-role-criacao/10',
      href: '/material-criacao',
      roles: ['dev', 'criacao'],
    },
    {
      title: 'Notificações',
      description: 'Veja os avisos recentes',
      icon: Bell,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      href: '/notificacoes',
      roles: ['dev', 'admin', 'gerente'],
    },
    {
      title: 'Central de Ajuda',
      description: 'Guias e suporte',
      icon: HelpCircle,
      color: 'text-role-gerente',
      bgColor: 'bg-role-gerente/10',
      href: '/ajuda',
      roles: ['dev', 'admin', 'gerente', 'vendedor', 'criacao'],
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Cadastro e permissões',
      icon: Users,
      color: 'text-role-admin',
      bgColor: 'bg-role-admin/10',
      href: '/usuarios',
      roles: ['dev', 'admin'],
    },
  ];

  const filteredActions = quickActions.filter(action => 
    user?.role && (action.roles.includes(user.role) || user.role === 'dev')
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {user?.profile?.full_name?.split(' ')[0] || 'Usuário'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Confira as informações do seu painel
            </p>
          </div>
          {user?.role && (
            <RoleBadge role={user.role} />
          )}
        </div>

        {/* Notifications Section */}
        {recentNotifications.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-warning" />
                  Notificações Recentes
                </CardTitle>
                <Link to="/notificacoes">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors gap-1">
                    Ver todas
                    <ArrowRight className="w-3 h-3" />
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentNotifications.map((notif) => (
                  <div
                    key={`${notif.type}-${notif.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className={`p-2 rounded-full mt-0.5 ${notif.type === 'individual' ? 'bg-primary/10' : 'bg-warning/10'}`}>
                      <Bell className={`w-4 h-4 ${notif.type === 'individual' ? 'text-primary' : 'text-warning'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {hasFullAccess(user?.role) && (
            <OnlineUsersCard />
          )}
          {filteredStats.map((stat) => {
            const Icon = stat.icon;
            const hasBreakdown = 'breakdown' in stat && stat.breakdown;
            return (
              <Link key={stat.title} to={stat.href}>
                <Card className="hover:shadow-md transition-all hover:border-primary/50 cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold mt-1">
                          {loading ? '-' : stat.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stat.description}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                    </div>
                    {hasBreakdown && !loading && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {stat.breakdown.pdf > 0 && (
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-muted-foreground">{stat.breakdown.pdf} PDF</span>
                            </div>
                          )}
                          {stat.breakdown.word > 0 && (
                            <div className="flex items-center gap-1.5">
                              <File className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-muted-foreground">{stat.breakdown.word} Word</span>
                            </div>
                          )}
                          {stat.breakdown.excel > 0 && (
                            <div className="flex items-center gap-1.5">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
                              <span className="text-muted-foreground">{stat.breakdown.excel} Excel</span>
                            </div>
                          )}
                          {stat.breakdown.powerpoint > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Presentation className="w-3.5 h-3.5 text-orange-600" />
                              <span className="text-muted-foreground">{stat.breakdown.powerpoint} PPT</span>
                            </div>
                          )}
                          {stat.breakdown.image > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Image className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-muted-foreground">{stat.breakdown.image} Imagem</span>
                            </div>
                          )}
                          {stat.breakdown.video > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-pink-500" />
                              <span className="text-muted-foreground">{stat.breakdown.video} Vídeo</span>
                            </div>
                          )}
                          {stat.breakdown.audio > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Music className="w-3.5 h-3.5 text-cyan-500" />
                              <span className="text-muted-foreground">{stat.breakdown.audio} Áudio</span>
                            </div>
                          )}
                          {stat.breakdown.zip > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Archive className="w-3.5 h-3.5 text-yellow-600" />
                              <span className="text-muted-foreground">{stat.breakdown.zip} ZIP</span>
                            </div>
                          )}
                          {stat.breakdown.link > 0 && (
                            <div className="flex items-center gap-1.5">
                              <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="text-muted-foreground">{stat.breakdown.link} Link</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as principais funcionalidades
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link 
                    key={action.href} 
                    to={action.href}
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className={`p-2 rounded-lg ${action.bgColor}`}>
                      <Icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* Support & Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="w-5 h-5 text-primary" />
                Suporte
              </CardTitle>
              <CardDescription>
                Precisa de ajuda?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link 
                to="/tickets" 
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TicketIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Meus Chamados</p>
                    {stats.openTickets > 0 && (
                      <Badge variant="secondary" className="mt-1">
                        {stats.openTickets} aberto{stats.openTickets > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <Link 
                to="/tickets/novo" 
                className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <HelpCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Abrir Chamado</p>
                    <p className="text-xs text-muted-foreground">Reportar erro ou solicitar ajuda</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <Link 
                to="/ajuda" 
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-role-gerente/10">
                    <HelpCircle className="w-5 h-5 text-role-gerente" />
                  </div>
                  <div>
                    <p className="font-medium">Central de Ajuda</p>
                    <p className="text-xs text-muted-foreground">Guias e tutoriais</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Activity Ranking & Links */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {user?.role && <ActivityRankingCard />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                Links Úteis
              </CardTitle>
              <CardDescription>
                Acesso rápido a sistemas e recursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkFiles.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum link disponível</p>
              ) : (
                <div className="space-y-3">
                  {linkFiles.map((link) => (
                    <a 
                      key={link.id} 
                      href={link.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <ExternalLink className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{link.name}</p>
                        {link.description && (
                          <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
