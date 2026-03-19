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
  extensionInstalled?: boolean;
  linkedinConnected?: boolean;
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

const CACHE_KEY = 'wassel_user_cache';
const TOKEN_KEY = 'supabase_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Try loading cached user immediately — no spinner
  const cached = (() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Cache valid for 24 hours
      if (parsed && parsed.cachedAt && Date.now() - parsed.cachedAt < 86400000) {
        return parsed as AuthUser;
      }
      return null;
    } catch { return null; }
  })();

  const cachedToken = localStorage.getItem(TOKEN_KEY) || null;

  const [user, setUser] = useState<AuthUser | null>(cached);
  const [loading, setLoading] = useState(!cached); // No loading if cache exists
  const [accessToken, setAccessToken] = useState<string | null>(cachedToken);

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
      // Fetch profile with role
      let { data: profile } = await supabase
        .from('profiles')
        .select('role, extension_installed, linkedin_connected')
        .eq('id', supabaseUser.id)
        .single();

      // Auto-provision profile for new users (e.g. Google OAuth)
      if (!profile) {
        const fullName = supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || '';
        await supabase.from('profiles').upsert({
          id: supabaseUser.id,
          email: supabaseUser.email,
          full_name: fullName,
          role: 'client_user',
        }, { onConflict: 'id' });
        profile = { role: 'client_user', extension_installed: false, linkedin_connected: false };
      }

      if (profile?.role === 'super_admin') {
        baseUser.role = 'super_admin';
      }

      // Extension installed flag
      baseUser.extensionInstalled = !!(profile as any)?.extension_installed;

      // LinkedIn connected flag (set by OAuth callback)
      baseUser.linkedinConnected = !!(profile as any)?.linkedin_connected;

      // Fetch team membership
      let { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', supabaseUser.id)
        .limit(1)
        .single();

      // Auto-provision team for new users
      if (!membership) {
        const teamName = (supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'My') + "'s Team";
        const { data: newTeam } = await supabase
          .from('teams')
          .insert({ name: teamName, plan: 'trial', status: 'active' })
          .select('id')
          .single();

        if (newTeam?.id) {
          await supabase.from('team_members').insert({
            team_id: newTeam.id,
            user_id: supabaseUser.id,
            role: 'owner',
          });
          membership = { team_id: newTeam.id };
        }
      }

      if (membership?.team_id) {
        baseUser.teamId = membership.team_id;
      }
    } catch (err) {
      console.warn('[Auth] Failed to load/provision profile/team:', err);
    }

    return baseUser;
  }

  /** Cache user data to localStorage */
  function cacheUser(authUser: AuthUser) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ...authUser,
        cachedAt: Date.now(),
      }));
    } catch { /* quota exceeded — ignore */ }
  }

  async function handleSession(session: Session | null) {
    if (session?.user) {
      const enrichedUser = await loadUserProfile(session.user, session.access_token);
      setUser(enrichedUser);
      setAccessToken(session.access_token);
      cacheUser(enrichedUser);
    } else {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(CACHE_KEY);
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // If we already have cached data, update silently in background
          if (cached) {
            setAccessToken(session.access_token);
            localStorage.setItem(TOKEN_KEY, session.access_token);
            // Silently refresh profile in background — no spinner
            loadUserProfile(session.user, session.access_token).then(enriched => {
              setUser(enriched);
              cacheUser(enriched);
            });
          } else {
            // No cache — must wait for full load
            await handleSession(session);
          }
        } else {
          // Check if there's a pending hash session (magic link redirect)
          // If so, don't clear — onAuthStateChange will fire when Supabase processes the hash
          const hasPendingHash = typeof window !== 'undefined' &&
            (window.location.hash.includes('access_token=') || window.location.hash.includes('type=magiclink'));

          if (!hasPendingHash) {
            // No session and no pending hash — clear everything
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(TOKEN_KEY);
          }
          // If hasPendingHash: wait for onAuthStateChange to fire
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // On a fresh sign-in, always bust the stale cache so linkedinConnected/extensionInstalled
          // are re-read from DB (not from a potentially stale 24h localStorage cache)
          if (event === 'SIGNED_IN') {
            localStorage.removeItem(CACHE_KEY);
          }
          setAccessToken(session.access_token);
          localStorage.setItem(TOKEN_KEY, session.access_token);
          const enriched = await loadUserProfile(session.user, session.access_token);
          setUser(enriched);
          cacheUser(enriched);
        } else {
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(TOKEN_KEY);
        }
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

    if (data.user && !data.session) {
      return { error: 'Please check your email to confirm your account.' };
    }

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
    localStorage.removeItem('wassel_admin_key');
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  // Keep token in sync
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
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
