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
import AdSlot from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
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
  DoorOpen,
  ClipboardList,
  Briefcase,
  Receipt,
  Wallet,
  Inbox,
} from "lucide-react";

import { useTimeClockReminder } from "@/hooks/useTimeClockReminder";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { cn } from "@/lib/utils";
import NotificationBanner from "@/components/NotificationBanner";
import PersistentNotificationAlert from "@/components/PersistentNotificationAlert";
import { Eye, EyeOff } from "lucide-react";

import { AppRole, ROLE_LABELS } from "@/types/auth";
import { UsersRound } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: AppRole[];
  highlight?: boolean;
  showNewBadge?: boolean;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"], showNewBadge: true },
  { label: "Ponto", href: "/ponto", icon: Clock, roles: ["dev", "admin", "gerente", "vendedor"] },
  { label: "Reunião", href: "/reunioes", icon: Video, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"] },
  { label: "Reserva de Salas", href: "/reserva-salas", icon: DoorOpen, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"] },
  { label: "Localizar", href: "/localizar", icon: MapPin, roles: ["dev"] },
  { label: "Metas", href: "/metas", icon: Target, roles: ["dev", "admin", "gerente", "vendedor"] },
  { label: "Reembolso", href: "/reembolsos", icon: Receipt, roles: ["dev", "admin", "vendedor"] },
  {
    label: "Financeiro",
    href: "/financeiro/reembolsos",
    icon: Wallet,
    roles: ["dev", "financeiro"],
    children: [
      { label: "Reembolsos", href: "/financeiro/reembolsos", icon: Receipt, roles: ["dev", "financeiro"] },
      { label: "Pontos", href: "/financeiro/pontos", icon: Clock, roles: ["dev", "financeiro"] },
    ],
  },
  {
    label: "CRM",
    href: "/crm-alimentador",
    icon: Briefcase,
    roles: ["dev", "sdr"],
    children: [
      { label: "Agendamentos CRM", href: "/agendamentos-crm", icon: CalendarCheck, roles: ["dev", "sdr"] },
    ],
  },
  {
    label: "Atendimento EAD",
    href: "/crm",
    icon: Handshake,
    roles: ["dev", "vendedor", "gerente", "admin"],
    children: [
      { label: "Agendamentos EAD", href: "/agendamentos", icon: CalendarCheck, roles: ["dev", "vendedor", "gerente", "admin"] },
    ],
  },
  // { label: "SAC", href: "/sac", icon: Inbox, roles: ["dev", "admin", "gerente", "vendedor", "sdr", "marketing", "qualidade", "financeiro"] },
  {
    label: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    roles: ["dev", "marketing"],
    children: [
      { label: "Depoimentos", href: "/depoimentos", icon: FileVideo, roles: ["dev", "marketing"] },
      { label: "Solicitações", href: "/solicitacoes", icon: ClipboardList, roles: ["dev", "marketing"] },
    ],
  },
  { label: "Gravações", href: "/gravacoes", icon: Film, roles: ["dev", "marketing"] },
  { label: "Categorias", href: "/categorias", icon: FolderOpen, roles: ["dev", "admin", "criacao"] },
  { label: "Usuários", href: "/usuarios", icon: Users, roles: ["dev", "admin"] },
  { label: "Inativos", href: "/inativos", icon: UserX, roles: ["dev", "admin"] },
  { label: "Equipe", href: "/equipe", icon: UsersRound, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "financeiro"] },
  { label: "Arquivos", href: "/arquivos", icon: Upload, roles: ["dev", "admin"] },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, roles: ["dev", "admin", "gerente"] },
  { label: "Tabelas de Preços", href: "/precos", icon: DollarSign, roles: ["dev", "admin", "gerente", "vendedor", "sdr"] },
  { label: "Materiais Comerciais", href: "/downloads", icon: FileText, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing"] },
  { label: "Material Criação", href: "/material-criacao", icon: Package, roles: ["dev", "criacao", "marketing"] },
  { label: "Notificações", href: "/notificacoes", icon: Bell, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"] },
  {
    label: "Solicitar Ajuda",
    href: "/tickets",
    icon: TicketIcon,
    roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"],
    highlight: true,
  },
  { label: "FAQ", href: "/ajuda", icon: HelpCircle, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"] },
  { label: "Atualizações", href: "/atualizacoes", icon: Rocket, roles: ["dev", "admin", "gerente", "vendedor", "criacao", "sdr", "marketing", "qualidade", "financeiro"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut, loading, realRole, viewAsRole, setViewAsRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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
  const effectiveRoleForNav = user?.role === 'diretoria' ? 'dev' : user?.role;
  const filteredNavItems = effectiveRoleForNav
    ? navItems.filter((item) => item.roles.includes(effectiveRoleForNav))
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
            "fixed lg:sticky inset-y-0 left-0 z-50 w-64 gradient-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out lg:transform-none lg:h-screen",
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
                  const visibleChildren = (item.children || []).filter((c) =>
                    effectiveRoleForNav ? c.roles.includes(effectiveRoleForNav) : c.roles.includes("vendedor"),
                  );
                  const hasChildren = visibleChildren.length > 0;
                  const childActive = visibleChildren.some(
                    (c) => location.pathname === c.href || location.pathname.startsWith(c.href + "/"),
                  );
                  const isExpanded = expandedItems.includes(item.href) || childActive;

                  const renderRow = (entry: NavItem, opts?: { nested?: boolean; showChevron?: boolean }) => {
                    const Icon = entry.icon;
                    const isActive =
                      location.pathname === entry.href || location.pathname.startsWith(entry.href + "/");
                    const isNotificationsItem = entry.href === "/notificacoes";
                    const isUpdatesItem = entry.href === "/atualizacoes";
                    const isMeetingsItem = entry.href === "/reunioes";
                    const isDashboardItem = entry.showNewBadge;

                    const handleClick = () => {
                      setSidebarOpen(false);
                      if (isUpdatesItem && hasNewUpdates) markAsViewed();
                      if (opts?.showChevron) {
                        setExpandedItems((prev) =>
                          prev.includes(entry.href)
                            ? prev.filter((h) => h !== entry.href)
                            : [...prev, entry.href],
                        );
                      }
                    };

                    return (
                      <Link
                        key={entry.href}
                        to={entry.href}
                        onClick={handleClick}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative",
                          opts?.nested && "ml-6 py-2 text-sm",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                            : entry.highlight
                              ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5",
                            opts?.nested && "w-4 h-4",
                            entry.highlight && !isActive && "text-amber-400",
                            isUpdatesItem && hasNewUpdates && !isActive && "text-destructive animate-pulse",
                            isMeetingsItem && hasActiveMeetings && "text-red-500",
                          )}
                        />
                        <span className="font-medium flex-1">{entry.label}</span>

                        {opts?.showChevron && (
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        )}

                        {isMeetingsItem && hasActiveMeetings && (
                          <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded animate-pulse">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            AO VIVO
                          </span>
                        )}
                        {isNotificationsItem && unreadCount.total > 0 && (
                          <span className="absolute right-3 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse-glow">
                            {unreadCount.total > 9 ? "9+" : unreadCount.total}
                          </span>
                        )}
                        {isUpdatesItem && hasNewUpdates && !isActive && (
                          <span className="absolute right-3 w-2 h-2 bg-destructive rounded-full animate-pulse" />
                        )}
                        {isDashboardItem && unreadCount.total > 0 && !isActive && (
                          <span className="ml-auto px-2 py-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--destructive))]">
                            NOVO
                          </span>
                        )}
                      </Link>
                    );
                  };

                  return (
                    <div key={item.href} className="space-y-1">
                      {renderRow(item, { showChevron: hasChildren })}
                      {hasChildren && isExpanded && (
                        <div className="space-y-1">
                          {visibleChildren.map((child) => renderRow(child, { nested: true }))}
                        </div>
                      )}
                    </div>
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
          {viewAsRole && (
            <div className="bg-amber-500 text-black px-4 py-2 text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Visualizando como <strong>{ROLE_LABELS[viewAsRole]}</strong> (modo desenvolvedor)
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 bg-white"
                onClick={() => {
                  setViewAsRole(null);
                  navigate("/dashboard");
                }}
              >
                Sair do modo
              </Button>
            </div>
          )}
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
                    {realRole === "dev" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar como
                            {viewAsRole && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                {ROLE_LABELS[viewAsRole]}
                              </span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent className="w-48 bg-popover">
                              {(Object.keys(ROLE_LABELS) as AppRole[])
                                .filter((r) => r !== "dev")
                                .map((r) => (
                                  <DropdownMenuItem
                                    key={r}
                                    onClick={() => {
                                      setViewAsRole(r);
                                      navigate("/dashboard");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    {ROLE_LABELS[r]}
                                    {viewAsRole === r && (
                                      <span className="ml-auto text-xs">✓</span>
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              {viewAsRole && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setViewAsRole(null);
                                      navigate("/dashboard");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <EyeOff className="w-4 h-4 mr-2" />
                                    Voltar para Desenvolvedor
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      </>
                    )}
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
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
            <AdSlot />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
