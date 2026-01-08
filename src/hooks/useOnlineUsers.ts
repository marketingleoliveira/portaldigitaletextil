import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  session_started: string | null;
}

// 30 seconds threshold - if no heartbeat in 30s, consider offline
const OFFLINE_THRESHOLD = 30 * 1000;

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const filterOnlineUsers = useCallback((users: OnlineUser[]): OnlineUser[] => {
    const now = Date.now();
    return users.filter(user => {
      if (!user.is_online) return false;
      const lastSeen = new Date(user.last_seen).getTime();
      return (now - lastSeen) < OFFLINE_THRESHOLD;
    });
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      // Get users marked as online - we'll filter by last_seen client-side for accuracy
      const { data, error } = await supabase
        .from('user_presence')
        .select('user_id, is_online, last_seen, session_started')
        .eq('is_online', true);

      if (error) throw error;

      if (!isMountedRef.current) return;

      // Filter to only truly online users (recent heartbeat)
      const trulyOnlineUsers = filterOnlineUsers(data || []);
      
      setOnlineUsers(trulyOnlineUsers);
      setOnlineCount(trulyOnlineUsers.length);
    } catch (error) {
      console.error('Error fetching online users:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [filterOnlineUsers]);

  const isUserOnline = useCallback((userId: string): boolean => {
    const user = onlineUsers.find(u => u.user_id === userId);
    if (!user) return false;
    
    const lastSeen = new Date(user.last_seen).getTime();
    const now = Date.now();
    return user.is_online && (now - lastSeen) < OFFLINE_THRESHOLD;
  }, [onlineUsers]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Fetch immediately
    fetchOnlineUsers();

    // Subscribe to realtime changes for instant updates
    const channel = supabase
      .channel('user-presence-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          // Update local state immediately based on the change
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newRecord = payload.new as OnlineUser;
            setOnlineUsers(prev => {
              const now = Date.now();
              const lastSeen = new Date(newRecord.last_seen).getTime();
              const isRecentlyActive = (now - lastSeen) < OFFLINE_THRESHOLD;
              
              // Remove existing entry for this user
              const filtered = prev.filter(u => u.user_id !== newRecord.user_id);
              
              // Add if online and recently active
              if (newRecord.is_online && isRecentlyActive) {
                return [...filtered, newRecord];
              }
              
              return filtered;
            });
          } else if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { user_id?: string };
            if (oldRecord.user_id) {
              setOnlineUsers(prev => prev.filter(u => u.user_id !== oldRecord.user_id));
            }
          }
        }
      )
      .subscribe();

    // Refresh every 15 seconds to clean up stale entries
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        setOnlineUsers(prev => filterOnlineUsers(prev));
        // Also do a full fetch periodically to sync state
        fetchOnlineUsers();
      }
    }, 15 * 1000);

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchOnlineUsers, filterOnlineUsers]);

  // Update count whenever onlineUsers changes
  useEffect(() => {
    setOnlineCount(onlineUsers.length);
  }, [onlineUsers]);

  return { onlineUsers, onlineCount, loading, isUserOnline, refetch: fetchOnlineUsers };
};
