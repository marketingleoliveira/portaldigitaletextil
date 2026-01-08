import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LAST_VIEWED_KEY = 'last_viewed_updates_at';

export const useNewUpdates = () => {
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  const checkForNewUpdates = useCallback(async () => {
    try {
      const lastViewed = localStorage.getItem(LAST_VIEWED_KEY);
      
      const { data, error } = await supabase
        .from('development_updates')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setHasNewUpdates(false);
        return;
      }

      const latestUpdateDate = new Date(data.created_at).getTime();
      const lastViewedDate = lastViewed ? new Date(lastViewed).getTime() : 0;

      setHasNewUpdates(latestUpdateDate > lastViewedDate);
    } catch (error) {
      console.error('Error checking for new updates:', error);
      setHasNewUpdates(false);
    }
  }, []);

  const markAsViewed = useCallback(() => {
    localStorage.setItem(LAST_VIEWED_KEY, new Date().toISOString());
    setHasNewUpdates(false);
  }, []);

  useEffect(() => {
    checkForNewUpdates();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('new-updates-check')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'development_updates',
        },
        () => {
          setHasNewUpdates(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkForNewUpdates]);

  return { hasNewUpdates, markAsViewed };
};
