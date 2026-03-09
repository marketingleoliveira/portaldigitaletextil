import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useNewUpdates } from "@/hooks/useNewUpdates";
import { useActiveMeetings } from "@/hooks/useActiveMeetings";
import Logo from "@/components/Logo";
import SustainabilityBadge from "@/components/SustainabilityBadge";
import RoleBadge from "@/components/RoleBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FolderOpen,
  BarChart3,
  FileText,
  User,
  Upload,
  Package,
  HelpCircle,
  TicketIcon,
  Target,
  Loader2,
  Clock,
  Rocket,
  UserX,
  DollarSign,
  MapPin,
  Video,
  Film,
  Handshake,
  CalendarCheck,
  Megaphone,
  FileVideo,
} from "lucide-react";
import { useTimeClockReminder } from "@/hooks/useTimeClockReminder";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { cn } from "@/lib/utils";
import NotificationBanner from "@/components/NotificationBanner";
import PersistentNotificationAlert from "@/components/PersistentNotificationAlert";

import { AppRole } from "@/types/auth";
import { UsersRound } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: AppRole[];
  highlight?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
  { label: "Ponto", href: "/ponto", icon: Clock, roles: ["dev", "admin", "gerente", "vendedor"] },
  { label: "Reunião", href: "/reunioes", icon: Video, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
  { label: "Localizar", href: "/localizar", icon: MapPin, roles: ["dev"] },
  { label: "Metas", href: "/metas", icon: Target, roles: ["dev", "admin", "gerente", "vendedor"] },
  { label: "CRM", href: "/crm", icon: Handshake, roles: ["dev", "vendedor", "sdr"] },
  { label: "Agendamentos", href: "/agendamentos", icon: CalendarCheck, roles: ["dev", "vendedor", "sdr"] },
  { label: "Marketing", href: "/marketing", icon: Megaphone, roles: ["dev", "marketing"] },
  { label: "Depoimentos", href: "/depoimentos", icon: FileVideo, roles: ["dev", "marketing"] },
  { label: "Categorias", href: "/categorias", icon: FolderOpen, roles: ["dev", "admin", "criacao"] },
  { label: "Usuários", href: "/usuarios", icon: Users, roles: ["dev", "admin"] },
  { label: "Inativos", href: "/inativos", icon: UserX, roles: ["dev", "admin"] },
  { label: "Equipe", href: "/equipe", icon: UsersRound, roles: ["dev", "admin", "gerente", "vendedor", "criacao"] },
  { label: "Arquivos", href: "/arquivos", icon: Upload, roles: ["dev", "admin"] },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, roles: ["dev", "admin", "gerente"] },
  { label: "Tabelas de Preços", href: "/precos", icon: DollarSign, roles: ["dev", "admin", "gerente", "vendedor", "sdr"] },
  { label: "Materiais Comerciais", href: "/downloads", icon: FileText, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
  { label: "Material Criação", href: "/material-criacao", icon: Package, roles: ["dev", "criacao", "marketing"] },
  { label: "Notificações", href: "/notificacoes", icon: Bell, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
  {
    label: "Solicitar Ajuda",
    href: "/tickets",
    icon: TicketIcon,
    roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"],
    highlight: true,
  },
  { label: "FAQ", href: "/ajuda", icon: HelpCircle, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
  { label: "Atualizações", href: "/atualizacoes", icon: Rocket, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Time clock reminder alerts
  useTimeClockReminder();

  // Location tracking for all users
  useLocationTracking();

  // User presence tracking
  useUserPresence();

  const { unreadCount, newAlerts, showBanner, setShowBanner, dismissAlert, dismissAllAlerts } =
    useNotificationContext();
  const { hasNewUpdates, markAsViewed } = useNewUpdates();
  const { hasActiveMeetings } = useActiveMeetings();

  // Show loading spinner only during initial load, not indefinitely
  const isUserDataLoading = loading;

  // Filter nav items - if role not available, show minimal nav
  const filteredNavItems = user?.role
    ? navItems.filter((item) => item.roles.includes(user.role!))
    : navItems.filter((item) => item.roles.includes("vendedor")); // Default to minimal access

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Notification Banner */}
      {showBanner && (
        <NotificationBanner
          notifications={unreadCount.total}
          ticketMessages={unreadCount.ticketMessages}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      {/* Persistent Alert Modal */}
      <PersistentNotificationAlert alerts={newAlerts} onDismiss={dismissAlert} onDismissAll={dismissAllAlerts} />

      <div className="flex flex-1">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 w-64 gradient-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out lg:transform-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <Logo variant="light" />
                <SustainabilityBadge />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {isUserDataLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-sidebar-foreground/50" />
                </div>
              ) : (
                filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                  const isNotificationsItem = item.href === "/notificacoes";
                  const isUpdatesItem = item.href === "/atualizacoes";
                  const isMeetingsItem = item.href === "/reunioes";

                  const handleClick = () => {
                    setSidebarOpen(false);
                    if (isUpdatesItem && hasNewUpdates) {
                      markAsViewed();
                    }
                  };

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={handleClick}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                          : item.highlight
                            ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className={cn(
                        "w-5 h-5", 
                        item.highlight && !isActive && "text-amber-400",
                        isUpdatesItem && hasNewUpdates && !isActive && "text-destructive animate-pulse",
                        isMeetingsItem && hasActiveMeetings && "text-red-500"
                      )} />
                      <span className="font-medium">{item.label}</span>

                      {/* Live indicator for active meetings */}
                      {isMeetingsItem && hasActiveMeetings && (
                        <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded animate-pulse">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          AO VIVO
                        </span>
                      )}

                      {/* Badge for notifications */}
                      {isNotificationsItem && unreadCount.total > 0 && (
                        <span className="absolute right-3 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse-glow">
                          {unreadCount.total > 9 ? "9+" : unreadCount.total}
                        </span>
                      )}

                      {/* Indicator for new updates */}
                      {isUpdatesItem && hasNewUpdates && !isActive && (
                        <span className="absolute right-3 w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      )}
                    </Link>
                  );
                })
              )}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3 px-2">
                {user?.profile?.avatar_url ? (
                  <img
                    src={user.profile.avatar_url}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-sidebar-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.profile?.full_name || "Usuário"}</p>
                  {user?.role && <RoleBadge role={user.role} size="sm" showIcon={false} />}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-30 bg-card border-b border-border">
            <div className="flex items-center justify-between h-16 px-4 lg:px-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <Menu className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-semibold hidden sm:block">
                  {filteredNavItems.find(
                    (item) => location.pathname === item.href || location.pathname.startsWith(item.href + "/"),
                  )?.label || "Portal"}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Notification Bell with enhanced visibility */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("relative", unreadCount.total > 0 && "animate-bounce-gentle")}
                  onClick={() => navigate("/notificacoes")}
                >
                  <Bell className={cn("w-5 h-5", unreadCount.total > 0 && "text-amber-500")} />
                  {unreadCount.total > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount.total > 9 ? "9+" : unreadCount.total}
                    </span>
                  )}
                </Button>

                {/* Ticket Bell */}
                {unreadCount.ticketMessages > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative animate-bounce-gentle"
                    onClick={() => navigate("/tickets")}
                  >
                    <TicketIcon className="w-5 h-5 text-amber-500" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount.ticketMessages > 9 ? "9+" : unreadCount.ticketMessages}
                    </span>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      {user?.profile?.avatar_url ? (
                        <img src={user.profile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <span className="hidden sm:inline-block">
                        {user?.profile?.full_name?.split(" ")[0] || "Usuário"}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user?.profile?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/perfil" className="cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        Meu Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
