import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AppRole } from '@/types/auth';
import {
  Target,
  Trophy,
  Calendar,
  Loader2,
  History,
  Users,
  User,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoricalGoal {
  id: string;
  title: string;
  description: string | null;
  target_value: number;
  unit: string;
  period_type: string;
  goal_type: string;
  target_user_id: string | null;
  created_at: string;
  is_active: boolean;
}

interface GoalProgress {
  id: string;
  goal_id: string;
  user_id: string;
  current_value: number;
  period_start: string;
  period_end: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  region: string | null;
  role?: string | null;
}

const periodLabels: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const periodColors: Record<string, string> = {
  daily: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  monthly: 'bg-green-500/20 text-green-400 border-green-500/30',
  yearly: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const formatValue = (value: number, unit: string): string => {
  if (unit === 'R$') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return `${value.toLocaleString('pt-BR')} ${unit}`;
};

const GoalHistory: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'dev' || user?.role === 'diretoria' || user?.role === 'gerente' || user?.role === 'admin';
  const isDev = user?.role === 'dev';

  const [goals, setGoals] = useState<HistoricalGoal[]>([]);
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // Fetch ALL goals (both active and inactive) to build complete history
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      let allGoals = (goalsData || []) as HistoricalGoal[];

      // Fetch ALL progress records
      const { data: allProgressData } = await supabase
        .from('goal_progress')
        .select('*');

      const allProgress = (allProgressData || []) as GoalProgress[];

      // Vendedores: only see goals assigned to them or team goals they participated in
      if (!isAdmin) {
        const userParticipatedGoalIds = new Set(
          allProgress
            .filter((p) => p.user_id === user?.id)
            .map((p) => p.goal_id)
        );

        allGoals = allGoals.filter(
          (g) =>
            g.target_user_id === user?.id ||
            (g.goal_type === 'team' && userParticipatedGoalIds.has(g.id))
        );
      }

      setGoals(allGoals);
      setProgress(allProgress);

      // Fetch all profiles and roles for dev view
      if (isAdmin) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, full_name, region')
          .eq('is_active', true);

        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role');

        const usersWithRoles = (usersData || []).map(u => ({
          ...u,
          role: rolesData?.find(r => r.user_id === u.id)?.role || null,
        }));

        setUsers(usersWithRoles);
      }
    } catch (error) {
      console.error('Error fetching goal history:', error);
      toast.error('Erro ao carregar histórico de metas');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente esta meta do histórico?')) return;
    try {
      await supabase.from('goal_progress').delete().eq('goal_id', goalId);
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (error) throw error;
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      toast.success('Meta excluída do histórico');
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Erro ao excluir meta');
    }
  };

  const getProgressForGoal = (goalId: string) => {
    if (isAdmin) {
      return progress
        .filter((p) => p.goal_id === goalId)
        .reduce((sum, p) => sum + p.current_value, 0);
    }
    return progress
      .filter((p) => p.goal_id === goalId && p.user_id === user?.id)
      .reduce((sum, p) => sum + p.current_value, 0);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Equipe';
    return users.find((u) => u.id === userId)?.full_name || 'Vendedor';
  };

  const filteredGoals = goals.filter((g) => {
    if (filterPeriod !== 'all' && g.period_type !== filterPeriod) return false;
    if (isAdmin && filterUser !== 'all') {
      if (filterUser === 'team') return g.goal_type === 'team';
      // Show individual goals assigned to user OR team goals where user has progress
      const isAssigned = g.target_user_id === filterUser;
      const hasProgress = g.goal_type === 'team' && progress.some(
        (p) => p.goal_id === g.id && p.user_id === filterUser
      );
      return isAssigned || hasProgress;
    }
    return true;
  });

  // Get all vendedores for the filter (not just those with goals)
  const allVendedores = isAdmin
    ? users.filter((u) => u.role === 'vendedor')
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            <SelectItem value="daily">Diárias</SelectItem>
            <SelectItem value="weekly">Semanais</SelectItem>
            <SelectItem value="monthly">Mensais</SelectItem>
            <SelectItem value="yearly">Anuais</SelectItem>
          </SelectContent>
        </Select>

        {isAdmin && allVendedores.length > 0 && (
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="team">Metas de Equipe</SelectItem>
              {allVendedores.map((vendedor) => (
                <SelectItem key={vendedor.id} value={vendedor.id}>
                  {vendedor.full_name} {vendedor.region && `(${vendedor.region})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Goals List */}
      {filteredGoals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {filterUser !== 'all' && isDev
                ? `Nenhuma meta registrada para ${getUserName(filterUser)}`
                : 'Nenhuma meta no histórico'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Metas desativadas aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const currentProgress = getProgressForGoal(goal.id);
            const percentage = goal.target_value > 0
              ? Math.min(Math.round((currentProgress / goal.target_value) * 100), 100)
              : 0;
            const isAchieved = currentProgress >= goal.target_value;

            return (
              <Card
                key={goal.id}
                className={`relative overflow-hidden transition-all ${
                  isAchieved
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'bg-muted/20 opacity-80'
                }`}
              >
                {isAchieved && !isDev && (
                  <div className="absolute top-3 right-3">
                    <Trophy className="w-6 h-6 text-green-500" />
                  </div>
                )}
                {isDev && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    {isAchieved && <Trophy className="w-5 h-5 text-green-500" />}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteGoal(goal.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={periodColors[goal.period_type] || ''}>
                      <Calendar className="w-3 h-3 mr-1" />
                      {periodLabels[goal.period_type] || goal.period_type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {goal.goal_type === 'team' ? (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> Equipe
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {isAdmin ? getUserName(goal.target_user_id) : 'Individual'}
                        </span>
                      )}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                      {format(new Date(goal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                  {goal.description && (
                    <CardDescription className="mt-1 text-xs">
                      {goal.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso final</span>
                      <span className="font-semibold">
                        {formatValue(currentProgress, goal.unit)} /{' '}
                        {formatValue(goal.target_value, goal.unit)}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          isAchieved ? 'text-green-500' : 'text-muted-foreground'
                        }`}
                      >
                        {percentage}% {isAchieved ? '✅ Concluída' : '❌ Não atingida'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GoalHistory;
