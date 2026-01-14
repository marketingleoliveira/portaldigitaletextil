import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 10 * 1000; // 10 seconds
const DURATION_UPDATE_INTERVAL = 1000; // 1 second

// Global flag to check if user is in a meeting (set by MeetingRoom)
let isUserInMeeting = false;

export const setUserInMeeting = (value: boolean) => {
  isUserInMeeting = value;
};

export const useUserPresence = () => {
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const durationUpdateRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for function callbacks to avoid effect re-runs
  const startSessionRef = useRef<() => Promise<void>>();
  const endSessionRef = useRef<() => Promise<void>>();
  const updatePresenceRef = useRef<(isOnline: boolean) => Promise<void>>();
  const updateSessionDurationRef = useRef<() => Promise<void>>();

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user?.id) return;

    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen: now,
          session_started: isOnline ? (sessionIdRef.current ? undefined : now) : null,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error updating presence:', error);
      }
    } catch (error) {
      console.error('Error in updatePresence:', error);
    }
  }, [user?.id]);

  // Update session duration in real-time (only duration, NOT session_end - that's for when session truly ends)
  const updateSessionDuration = useCallback(async () => {
    if (!user?.id || !sessionIdRef.current || !sessionStartRef.current) return;

    try {
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 1000);

      await supabase
        .from('user_activity_sessions')
        .update({
          duration_seconds: durationSeconds,
        })
        .eq('id', sessionIdRef.current);
    } catch (error) {
      console.error('Error updating session duration:', error);
    }
  }, [user?.id]);

  const startSession = useCallback(async () => {
    if (!user?.id) return;
    
    // If we already have a session, don't create a new one
    if (sessionIdRef.current && sessionStartRef.current) return;

    try {
      // First check if there's an active session for this user
      const { data: existingSession } = await supabase
        .from('user_activity_sessions')
        .select('id, session_start')
        .eq('user_id', user.id)
        .is('session_end', null)
        .order('session_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        // Resume existing session
        sessionIdRef.current = existingSession.id;
        sessionStartRef.current = new Date(existingSession.session_start);
        await updatePresence(true);
        return;
      }

      // Create new session
      const now = new Date();
      
      const { data, error } = await supabase
        .from('user_activity_sessions')
        .insert({
          user_id: user.id,
          session_start: now.toISOString(),
          duration_seconds: 0,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error starting session:', error);
        return;
      }

      sessionIdRef.current = data.id;
      sessionStartRef.current = now;
      await updatePresence(true);
    } catch (error) {
      console.error('Error in startSession:', error);
    }
  }, [user?.id, updatePresence]);

  const endSession = useCallback(async () => {
    if (!user?.id || !sessionIdRef.current || !sessionStartRef.current) return;

    try {
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 1000);

      // Set session_end only when session truly ends
      await supabase
        .from('user_activity_sessions')
        .update({
          duration_seconds: durationSeconds,
          session_end: now.toISOString(),
        })
        .eq('id', sessionIdRef.current);

      await updatePresence(false);
      sessionIdRef.current = null;
      sessionStartRef.current = null;
    } catch (error) {
      console.error('Error in endSession:', error);
    }
  }, [user?.id, updatePresence]);

  // Update refs when callbacks change
  startSessionRef.current = startSession;
  endSessionRef.current = endSession;
  updatePresenceRef.current = updatePresence;
  updateSessionDurationRef.current = updateSessionDuration;

  useEffect(() => {
    if (!user?.id) return;

    // Start session when hook mounts
    startSessionRef.current?.();

    // Heartbeat to keep presence alive
    heartbeatRef.current = setInterval(() => {
      updatePresenceRef.current?.(true);
    }, HEARTBEAT_INTERVAL);

    // Update duration every second for precise tracking
    durationUpdateRef.current = setInterval(() => {
      updateSessionDurationRef.current?.();
    }, DURATION_UPDATE_INTERVAL);

    // Handle visibility change (skip if user is in a meeting)
    const handleVisibilityChange = async () => {
      // If user is in a meeting, don't change presence status
      if (isUserInMeeting) {
        return;
      }

      if (document.hidden) {
        // User minimized or switched tabs - update duration but DON'T mark offline
        await updateSessionDurationRef.current?.();
      } else {
        // User came back - ensure we're marked online
        await updatePresenceRef.current?.(true);
      }
    };

    // Handle before unload - use synchronous approach for reliability
    const handleBeforeUnload = () => {
      // Mark session as ended and user as offline using synchronous XHR
      if (sessionIdRef.current && sessionStartRef.current) {
        const now = new Date();
        const durationSeconds = Math.floor((now.getTime() - sessionStartRef.current.getTime()) / 1000);
        
        // Synchronous XHR for session update
        const sessionXhr = new XMLHttpRequest();
        sessionXhr.open('PATCH', `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_sessions?id=eq.${sessionIdRef.current}`, false);
        sessionXhr.setRequestHeader('Content-Type', 'application/json');
        sessionXhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        sessionXhr.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
        sessionXhr.setRequestHeader('Prefer', 'return=minimal');
        try {
          sessionXhr.send(JSON.stringify({
            session_end: now.toISOString(),
            duration_seconds: durationSeconds,
          }));
        } catch (e) {
          console.error('Error updating session on unload:', e);
        }
      }
      
      // Synchronous XHR for presence update
      const presenceXhr = new XMLHttpRequest();
      presenceXhr.open('PATCH', `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`, false);
      presenceXhr.setRequestHeader('Content-Type', 'application/json');
      presenceXhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      presenceXhr.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
      presenceXhr.setRequestHeader('Prefer', 'return=minimal');
      try {
        presenceXhr.send(JSON.stringify({
          is_online: false,
          last_seen: new Date().toISOString(),
        }));
      } catch (e) {
        console.error('Error updating presence on unload:', e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (durationUpdateRef.current) {
        clearInterval(durationUpdateRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSessionRef.current?.();
    };
  }, [user?.id]);

  return { 
    updatePresence,
  };
};
