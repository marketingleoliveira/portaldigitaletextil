import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useActiveMeetings = () => {
  const [hasActiveMeetings, setHasActiveMeetings] = useState(false);
  const [activeMeetingsCount, setActiveMeetingsCount] = useState(0);

  useEffect(() => {
    const fetchActiveMeetings = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id')
        .eq('is_active', true);

      if (!error && data) {
        setHasActiveMeetings(data.length > 0);
        setActiveMeetingsCount(data.length);
      }
    };

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
  }, []);

  return { hasActiveMeetings, activeMeetingsCount };
};
