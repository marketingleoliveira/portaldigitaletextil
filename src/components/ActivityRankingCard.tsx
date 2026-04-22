import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Trophy, Clock } from 'lucide-react';
import { AppRole } from '@/types/auth';

interface UserActivity {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_duration: number;
  region?: string | null;
}

interface ProfileWithRole {
  id: string;
  full_name: string;
  avatar_url: string | null;
  region?: string | null;
  role?: AppRole;
}

const getWeekStart = () => {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  weekStart.setDate(weekStart.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
};

const ActivityRankingCard: React.FC = () => {
  const [ranking, setRanking] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const sessionsRef = useRef<any[]>([]);
  const profilesRef = useRef<ProfileWithRole[]>([]);
  const onlineUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
    
    // Refetch data every 30 seconds to get fresh session data
    const refetchInterval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(refetchInterval);
  }, []);

  // Real-time subscription for sessions and presence
  useEffect(() => {
    const channel = supabase
      .channel('activity-ranking-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'user_activity_sessions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            sessionsRef.current = [...sessionsRef.current, payload.new];
          } else if (payload.eventType === 'UPDATE') {
            // Update existing session with new data
            sessionsRef.current = sessionsRef.current.map(s => 
              s.id === payload.new.id ? payload.new : s
            );
          } else if (payload.eventType === 'DELETE') {
            sessionsRef.current = sessionsRef.current.filter(s => s.id !== payload.old.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload: any) => {
          const newData = payload.new;
          if (newData?.is_online) {
            // Check if last_seen is within 30 seconds
            const lastSeen = new Date(newData.last_seen).getTime();
            const now = Date.now();
            if (now - lastSeen < 30000) {
              onlineUsersRef.current.add(newData.user_id);
            } else {
              onlineUsersRef.current.delete(newData.user_id);
            }
          } else if (newData?.user_id) {
            onlineUsersRef.current.delete(newData.user_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update ranking every second for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      if (profilesRef.current.length > 0) {
        calculateRanking();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const weekStart = getWeekStart();

      // Consider users online only if last_seen is within the last 30 seconds
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

      const [profilesRes, rolesRes, sessionsRes, presenceRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, region')
          .eq('is_active', true),
        supabase
          .from('user_roles')
          .select('user_id, role'),
        supabase
          .from('user_activity_sessions')
          .select('user_id, session_start, session_end, duration_seconds')
          .gte('session_start', weekStart.toISOString()),
        supabase
          .from('user_presence')
          .select('user_id, is_online, last_seen')
          .eq('is_online', true)
          .gte('last_seen', thirtySecondsAgo),
      ]);

      // Filter only vendedores (exclude admin, dev, gerente, criacao)
      const vendedorUserIds = new Set(
        (rolesRes.data || [])
          .filter(r => r.role === 'vendedor')
          .map(r => r.user_id)
      );

      // Create a map of user_id to role
      const roleMap = new Map((rolesRes.data || []).map(r => [r.user_id, r.role]));

      // Filter profiles to only include vendedores
      if (profilesRes.data) {
        profilesRef.current = profilesRes.data
          .filter(p => vendedorUserIds.has(p.id))
          .map(p => ({
            ...p,
            role: roleMap.get(p.id) as AppRole
          }));
      }
      
      if (sessionsRes.data) sessionsRef.current = sessionsRes.data;
      if (presenceRes.data) {
        onlineUsersRef.current = new Set(presenceRes.data.map(p => p.user_id));
      }

      calculateRanking();
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRanking = () => {
    const now = Date.now();
    const userDurations = new Map<string, number>();
    const MAX_SESSION_SECONDS = 10 * 60 * 60; // Cap any single session at 10 hours

    sessionsRef.current.forEach(session => {
      if (!profilesRef.current.some(p => p.id === session.user_id)) {
        return;
      }

      const sessionStart = new Date(session.session_start).getTime();
      let duration: number;

      if (!session.session_end) {
        // Open session
        if (onlineUsersRef.current.has(session.user_id)) {
          duration = Math.floor((now - sessionStart) / 1000);
        } else {
          // Offline with open session - cap at max
          duration = Math.min(Math.floor((now - sessionStart) / 1000), MAX_SESSION_SECONDS);
        }
      } else {
        // Closed session - ALWAYS calculate from start/end times (duration_seconds is unreliable)
        const sessionEnd = new Date(session.session_end).getTime();
        duration = Math.max(0, Math.floor((sessionEnd - sessionStart) / 1000));
      }

      // Cap any single session duration
      duration = Math.min(duration, MAX_SESSION_SECONDS);

      const current = userDurations.get(session.user_id) || 0;
      userDurations.set(session.user_id, current + duration);
    });

    const rankingData: UserActivity[] = profilesRef.current
      .map(profile => ({
        user_id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        region: profile.region,
        total_duration: userDurations.get(profile.id) || 0,
      }))
      .filter(u => u.total_duration > 0)
      .sort((a, b) => b.total_duration - a.total_duration)
      .slice(0, 3);

    setRanking(rankingData);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getMedalStyle = (position: number) => {
    switch (position) {
      case 0:
        return {
          bg: 'bg-gradient-to-r from-yellow-400/20 via-yellow-300/20 to-yellow-500/20',
          border: 'border-yellow-400/50',
          medal: '🏆',
          shimmer: true,
        };
      case 1:
        return {
          bg: 'bg-gradient-to-r from-slate-300/20 via-slate-200/20 to-slate-400/20',
          border: 'border-slate-400/50',
          medal: '🥈',
          shimmer: false,
        };
      case 2:
        return {
          bg: 'bg-gradient-to-r from-amber-600/20 via-amber-500/20 to-amber-700/20',
          border: 'border-amber-600/50',
          medal: '🥉',
          shimmer: false,
        };
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-transparent',
          medal: '',
          shimmer: false,
        };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 3 Mais Ativos da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Top 3 Mais Ativos da Semana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma atividade registrada nesta semana
          </p>
        ) : (
          ranking.map((user, index) => {
            const style = getMedalStyle(index);
            return (
              <div
                key={user.user_id}
                className={`relative flex items-center gap-3 p-3 rounded-lg border ${style.bg} ${style.border} transition-all ${
                  style.shimmer ? 'animate-pulse' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xl">{style.medal}</span>
                  <Avatar className="w-9 h-9 border-2 border-background">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs font-semibold">
                      {user.full_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {user.full_name}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="font-mono">{formatDuration(user.total_duration)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityRankingCard;
