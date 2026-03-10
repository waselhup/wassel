import { createContext, useContext, useEffect, useState } from 'react';
import { createClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'super_admin' | 'client_user';

export type AuthUser = {
  id: string;
  email?: string;
  role: UserRole;
  teamId?: string | null;
  user_metadata?: Record<string, any>;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  /**
   * Load role and teamId from the backend profile
   */
  async function loadUserProfile(supabaseUser: any, token: string): Promise<AuthUser> {
    const baseUser: AuthUser = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      role: 'client_user',
      teamId: null,
      user_metadata: supabaseUser.user_metadata,
    };

    try {
      // Fetch profile with role from backend via tRPC or direct query
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', supabaseUser.id)
        .single();

      if (profile?.role === 'super_admin') {
        baseUser.role = 'super_admin';
      }

      // Fetch team membership
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', supabaseUser.id)
        .limit(1)
        .single();

      if (membership?.team_id) {
        baseUser.teamId = membership.team_id;
      }
    } catch (err) {
      console.warn('[Auth] Failed to load profile/team:', err);
    }

    return baseUser;
  }

  async function handleSession(session: Session | null) {
    if (session?.user) {
      const enrichedUser = await loadUserProfile(session.user, session.access_token);
      setUser(enrichedUser);
      setAccessToken(session.access_token);
    } else {
      setUser(null);
      setAccessToken(null);
    }
  }

  useEffect(() => {
    // Check current session
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleSession(session);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await handleSession(session);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) return { error: error.message };

    // If email confirmation is required, let the user know
    if (data.user && !data.session) {
      return { error: 'Please check your email to confirm your account.' };
    }

    // Create profile entry (trigger should handle this, but as fallback)
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName || null,
        role: 'client_user',
      }, { onConflict: 'id' });
    }

    return {};
  };

  const signOut = async () => {
    // Clear admin key if any
    localStorage.removeItem('wassel_admin_key');
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  // Store token in localStorage for tRPC and Express routes
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('supabase_token', accessToken);
    } else {
      localStorage.removeItem('supabase_token');
    }
  }, [accessToken]);

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
