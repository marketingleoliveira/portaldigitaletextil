import React from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import ReembolsosManager from '@/components/reembolsos/ReembolsosManager';
import { Receipt } from 'lucide-react';

const Reembolsos: React.FC = () => {
  const { user } = useAuth();

  if (!user?.id) return null;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reembolso de Viagens</h1>
            <p className="text-sm text-muted-foreground">
              Anexe os comprovantes de gastos da viagem e acompanhe o valor a ser reembolsado.
            </p>
          </div>
        </div>

        <ReembolsosManager userId={user.id} canEdit={true} canDelete={false} />
      </div>
    </DashboardLayout>
  );
};

export default Reembolsos;
