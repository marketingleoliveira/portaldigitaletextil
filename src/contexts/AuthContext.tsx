import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, UserProfile, AuthUser } from '@/types/auth';
import { getIpAddress } from '@/hooks/useIpAddress';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [userDataFetched, setUserDataFetched] = useState(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchUserData = useCallback(async (authUser: User, isLogin: boolean = false, force: boolean = false) => {
    // Skip if we already fetched data for this user (unless forced)
    if (!force && lastFetchedUserIdRef.current === authUser.id && userDataFetched) {
      return;
    }
    setUserDataLoading(true);
    setUserDataFetched(false);
    try {
      // Fetch profile with retry logic
      let profile = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!profile && retryCount < maxRetries) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }
        
        profile = profileData;
        
        if (!profile && retryCount < maxRetries - 1) {
          // Wait a bit before retrying (profile might not be created yet for new users)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        retryCount++;
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      const authUserData: AuthUser = {
        id: authUser.id,
        email: authUser.email || '',
        profile: profile as UserProfile | null,
        role: (roleData?.role as AppRole) || null,
      };

      setUser(authUserData);

      // Log access with IP only on login
      if (isLogin && profile) {
        try {
          const ipAddress = await getIpAddress();
          await supabase.from('access_logs').insert({
            user_id: authUser.id,
            action: 'login',
            resource_type: 'session',
            ip_address: ipAddress,
          });
        } catch (logError) {
          console.error('Error logging access:', logError);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Still set a basic user object to prevent blank screens
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        profile: null,
        role: null,
      });
    } finally {
      setUserDataLoading(false);
      setUserDataFetched(true);
      lastFetchedUserIdRef.current = authUser.id;
    }
  }, [userDataFetched]);

  useEffect(() => {
    let isMounted = true;

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      
      if (session?.user) {
        fetchUserData(session.user, false).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Set up auth state listener - IGNORE TOKEN_REFRESHED to prevent reloads
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        // Ignore TOKEN_REFRESHED events completely - they cause unnecessary reloads
        if (event === 'TOKEN_REFRESHED') {
          return;
        }
        
        setSession(session);
        
        if (session?.user) {
          // Only fetch on actual sign in or user update
          const isLogin = event === 'SIGNED_IN';
          const shouldFetch = isLogin || event === 'USER_UPDATED';
          
          if (shouldFetch) {
            setTimeout(() => {
              fetchUserData(session.user, isLogin, isLogin);
            }, 0);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          lastFetchedUserIdRef.current = null;
          setUserDataFetched(false);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error: error as Error | null };
  };

  // Combined loading state - only show loading until initial data fetch is complete
  const isLoading = loading || (session?.user && !userDataFetched);

  return (
    <AuthContext.Provider value={{ user, session, loading: isLoading, signIn, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};
