import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  // Show loading while auth or user data is being fetched
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!session || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User exists but profile not yet loaded and we're still loading
  // If loading is false but profile is null, user might be new or have an issue
  // Allow them to proceed and let the page handle it
  if (!user.profile) {
    // If profile is null after loading completes, show pending message
    // This could be a new user awaiting profile creation
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Configurando sua conta</h1>
          <p className="text-muted-foreground mb-4">
            Aguarde enquanto finalizamos a configuração do seu perfil. Isso pode levar alguns segundos.
          </p>
          <p className="text-sm text-muted-foreground">
            Em caso de dúvidas, entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  // User not active - awaiting approval
  if (!user.profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Aguardando Aprovação</h1>
          <p className="text-muted-foreground mb-4">
            Seu cadastro está sendo analisado por um administrador. Você receberá acesso ao portal assim que for aprovado.
          </p>
          <p className="text-sm text-muted-foreground">
            Em caso de dúvidas, entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  // Role-based access check (DEV has full access)
  if (allowedRoles && allowedRoles.length > 0) {
    // If user has no role assigned yet, redirect to dashboard (safe default)
    if (!user.role) {
      return <Navigate to="/dashboard" replace />;
    }
    
    // Check if user has permission (DEV always has access)
    const hasAccess = allowedRoles.includes(user.role) || user.role === 'dev' || user.role === 'diretoria';
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
