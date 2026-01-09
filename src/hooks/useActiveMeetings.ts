import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useActiveMeetings = () => {
  const [hasActiveMeetings, setHasActiveMeetings] = useState(false);
  const [activeMeetingsCount, setActiveMeetingsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveMeetings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('id')
        .eq('is_active', true)
        .is('ended_at', null); // Only count meetings that haven't ended

      if (!error && data) {
        setHasActiveMeetings(data.length > 0);
        setActiveMeetingsCount(data.length);
      }
    } catch (err) {
      console.error('Error fetching active meetings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveMeetings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('active-meetings-check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
        },
        () => {
          fetchActiveMeetings();
        }
      )
      .subscribe();

    // Refresh periodically in case realtime misses something
    const interval = setInterval(fetchActiveMeetings, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchActiveMeetings]);

  return { hasActiveMeetings, activeMeetingsCount, isLoading, refetch: fetchActiveMeetings };
};
