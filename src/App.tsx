import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import MeetingErrorBoundary from "@/components/MeetingErrorBoundary";
import { useUserPresence } from "@/hooks/useUserPresence";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { LocationRequestNotification } from "@/components/LocationRequestNotification";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import InactiveUsers from "./pages/InactiveUsers";
import Downloads from "./pages/Downloads";
import FileManagement from "./pages/FileManagement";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import Tickets from "./pages/Tickets";
import NewTicket from "./pages/NewTicket";
import TicketDetails from "./pages/TicketDetails";
import NotFound from "./pages/NotFound";
import Team from "./pages/Team";
import TimeClock from "./pages/TimeClock";
import Goals from "./pages/Goals";
import Updates from "./pages/Updates";
import Localizar from "./pages/Localizar";
import Prices from "./pages/Prices";
import Meetings from "./pages/Meetings";
import MeetingRoom from "./pages/MeetingRoom";
import GuestJoin from "./pages/GuestJoin";
import GuestMeetingRoom from "./pages/GuestMeetingRoom";

import CreationMaterials from "./pages/CreationMaterials";
import CRM from "./pages/CRM";
import CRMFeeder from "./pages/CRMFeeder";

import Agendamentos from "./pages/Agendamentos";
import AgendamentosCRM from "./pages/AgendamentosCRM";

import Marketing from "./pages/Marketing";
import Depoimentos from "./pages/Depoimentos";
import RoomReservations from "./pages/RoomReservations";
import Recordings from "./pages/Recordings";
import Solicitacoes from "./pages/Solicitacoes";
import Reembolsos from "./pages/Reembolsos";
import FinanceiroReembolsos from "./pages/FinanceiroReembolsos";
import FinanceiroPontos from "./pages/FinanceiroPontos";

const queryClient = new QueryClient();

// Component to track user presence and location
const PresenceTracker = ({ children }: { children: React.ReactNode }) => {
  useUserPresence();
  useLocationTracking();
  return (
    <>
      {children}
      <LocationRequestNotification />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <PresenceTracker>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  
                  {/* Protected Routes */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/produtos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                  <Route path="/produtos/:id" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
                  <Route path="/categorias" element={<ProtectedRoute allowedRoles={['dev', 'admin', 'criacao']}><Categories /></ProtectedRoute>} />
                  <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['dev', 'admin']}><Users /></ProtectedRoute>} />
                  <Route path="/inativos" element={<ProtectedRoute allowedRoles={['dev', 'admin']}><InactiveUsers /></ProtectedRoute>} />
                  <Route path="/equipe" element={<ProtectedRoute><Team /></ProtectedRoute>} />
                  <Route path="/arquivos" element={<ProtectedRoute allowedRoles={['dev', 'admin', 'criacao']}><FileManagement /></ProtectedRoute>} />
                  <Route path="/material-criacao" element={<ProtectedRoute allowedRoles={['dev', 'criacao', 'marketing']}><CreationMaterials /></ProtectedRoute>} />
                  <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
                  <Route path="/notificacoes" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['dev', 'admin', 'gerente']}><Reports /></ProtectedRoute>} />
                  <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/ajuda" element={<ProtectedRoute><Help /></ProtectedRoute>} />
                  <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
                  <Route path="/tickets/novo" element={<ProtectedRoute><NewTicket /></ProtectedRoute>} />
                  <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetails /></ProtectedRoute>} />
                  <Route path="/ponto" element={<ProtectedRoute><TimeClock /></ProtectedRoute>} />
                  <Route path="/localizar" element={<ProtectedRoute allowedRoles={['dev']}><Localizar /></ProtectedRoute>} />
                  <Route path="/metas" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
                  <Route path="/crm-alimentador" element={<ProtectedRoute allowedRoles={['dev', 'sdr']}><CRMFeeder /></ProtectedRoute>} />
                  <Route path="/crm" element={<ProtectedRoute allowedRoles={['dev', 'vendedor', 'gerente', 'admin']}><CRM /></ProtectedRoute>} />

                  <Route path="/agendamentos" element={<ProtectedRoute allowedRoles={['dev', 'vendedor', 'gerente', 'admin']}><Agendamentos /></ProtectedRoute>} />
                  <Route path="/agendamentos-crm" element={<ProtectedRoute allowedRoles={['dev', 'sdr']}><AgendamentosCRM /></ProtectedRoute>} />

                  <Route path="/precos" element={<ProtectedRoute><Prices /></ProtectedRoute>} />
                  <Route path="/atualizacoes" element={<ProtectedRoute><Updates /></ProtectedRoute>} />
                  <Route path="/marketing" element={<ProtectedRoute allowedRoles={['dev', 'marketing']}><Marketing /></ProtectedRoute>} />
                  <Route path="/depoimentos" element={<ProtectedRoute allowedRoles={['dev', 'marketing']}><Depoimentos /></ProtectedRoute>} />
                  <Route path="/reunioes" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
                  <Route path="/reserva-salas" element={<ProtectedRoute><RoomReservations /></ProtectedRoute>} />
                  <Route path="/gravacoes" element={<ProtectedRoute allowedRoles={['dev', 'marketing']}><Recordings /></ProtectedRoute>} />
                  <Route path="/solicitacoes" element={<ProtectedRoute allowedRoles={['dev', 'marketing']}><Solicitacoes /></ProtectedRoute>} />
                  <Route path="/reembolsos" element={<ProtectedRoute allowedRoles={['dev', 'admin', 'vendedor']}><Reembolsos /></ProtectedRoute>} />
                  <Route path="/financeiro/reembolsos" element={<ProtectedRoute allowedRoles={['dev', 'financeiro']}><FinanceiroReembolsos /></ProtectedRoute>} />
                  <Route path="/financeiro/pontos" element={<ProtectedRoute allowedRoles={['dev', 'financeiro']}><FinanceiroPontos /></ProtectedRoute>} />
                  <Route path="/reuniao/:code" element={<ProtectedRoute><MeetingErrorBoundary><MeetingRoom /></MeetingErrorBoundary></ProtectedRoute>} />
                  
                  <Route path="/entrar/:code" element={<GuestJoin />} />
                  <Route path="/convidado/:code" element={<MeetingErrorBoundary><GuestMeetingRoom /></MeetingErrorBoundary>} />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PresenceTracker>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
