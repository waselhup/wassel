import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  plan: 'free' | 'starter' | 'pro' | 'elite';
  token_balance: number;
  is_banned: boolean;
  is_admin?: boolean;
  verified: boolean;
  linkedin_score?: number;
  cvs_generated?: number;
  campaigns_sent?: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        return;
      }

      console.log('[AuthContext] Profile fetched:', { email: data?.email, token_balance: data?.token_balance, plan: data?.plan });

      let finalProfile: any = data;

      // Auto-sync OAuth photo into profiles.avatar_url — but ONLY for users
      // who don't already have a LinkedIn-sourced avatar. LinkedIn photos
      // (saved by linkedin.analyzeTargeted from the real scraped profile)
      // are the source of truth for our dashboard: they reflect the user's
      // actual professional presence, not their email-account avatar.
      //
      // The previous version of this code would clobber a stored LinkedIn
      // photo with the Google session-metadata photo because Google URLs
      // have no expiry and sorted "highest" — that bug is why Hassan's
      // avatar reverted to the H initial after every login.
      try {
        const isLinkedInUrl = (u: string | null | undefined): boolean =>
          !!u && typeof u === 'string' && u.includes('licdn.com');

        // LinkedIn signed URLs carry an `e=<unix-seconds>` query param.
        // Past-expiry URLs return 403 from the CDN, so we treat them as
        // unusable and try to refresh from either profile_analyses or OAuth.
        const linkedInExpiry = (u: string): number => {
          try {
            const e = new URL(u).searchParams.get('e');
            return e ? parseInt(e, 10) * 1000 : 0;
          } catch { return 0; }
        };
        const isLinkedInExpired = (u: string | null | undefined): boolean => {
          if (!isLinkedInUrl(u)) return false;
          const exp = linkedInExpiry(u!);
          return exp > 0 && exp < Date.now();
        };

        const { data: { session } } = await supabase.auth.getSession();
        const meta = session?.user?.user_metadata as Record<string, any> | undefined;

        const oauthName: string | undefined =
          meta?.full_name || meta?.name || meta?.given_name;

        // If the stored LinkedIn URL has expired, look up the freshest one
        // from the user's latest profile_analyses row (radar always saves
        // the live picture). Falls through to OAuth metadata when nothing
        // newer exists.
        let refreshedLinkedInPhoto: string | null = null;
        if (isLinkedInExpired(data?.avatar_url)) {
          try {
            const { data: latestAnalysis } = await supabase
              .from('profile_analyses')
              .select('profile_data')
              .eq('user_id', userId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            const candidate = (latestAnalysis as any)?.profile_data?.profilePicture;
            if (typeof candidate === 'string' && candidate.length > 10
                && candidate !== data?.avatar_url
                && !isLinkedInExpired(candidate)) {
              refreshedLinkedInPhoto = candidate;
            }
          } catch (e) {
            console.warn('[AuthContext] LinkedIn photo refresh lookup failed:', e);
          }
        }

        // Photo sync rules:
        //  - Stored LinkedIn (not expired) wins always → never touch it
        //  - Stored LinkedIn expired + newer LinkedIn exists → refresh it
        //  - No stored avatar or stored is OAuth-sourced → take best OAuth photo
        // Order in OAuth candidates prefers LinkedIn-OIDC photos when present.
        const update: Record<string, any> = {};

        if (refreshedLinkedInPhoto) {
          update.avatar_url = refreshedLinkedInPhoto;
        } else if (!isLinkedInUrl(data?.avatar_url) && meta) {
          const oauthCandidates: string[] = [
            isLinkedInUrl(meta.picture) ? meta.picture : null,
            isLinkedInUrl(meta.avatar_url) ? meta.avatar_url : null,
            meta.picture,
            meta.avatar_url,
            meta.profile_picture,
            meta.photo,
          ].filter((v): v is string => typeof v === 'string' && !!v);
          const bestPhoto = oauthCandidates[0];
          if (bestPhoto && bestPhoto !== data?.avatar_url) {
            update.avatar_url = bestPhoto;
          }
        }

        if (oauthName && !data?.full_name) update.full_name = oauthName;

        if (Object.keys(update).length > 0) {
          console.log('[AuthContext] Syncing profile metadata:', Object.keys(update),
            refreshedLinkedInPhoto ? '(refreshed expired LinkedIn URL)' : '');
          const { data: updated } = await supabase
            .from('profiles')
            .update(update)
            .eq('id', userId)
            .select('*')
            .single();
          if (updated) finalProfile = updated;
        }
      } catch (syncErr) {
        console.error('[AuthContext] OAuth photo sync failed (non-fatal):', syncErr);
      }

      setProfile(finalProfile as Profile);

      // Analytics: identify user
      try {
        const { identifyUser } = await import('../lib/analytics');
        identifyUser(userId, { email: finalProfile?.email, plan: finalProfile?.plan });
      } catch (_) {}
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session fetch error:', error);
          setLoading(false);
          return;
        }

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchProfile(initialSession.user.id);
        }

        setLoading(false);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, updatedSession) => {
            if (updatedSession) {
              setSession(updatedSession);
              setUser(updatedSession.user);
              await fetchProfile(updatedSession.user.id);
            } else {
              setSession(null);
              setUser(null);
              setProfile(null);
            }
          }
        );

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err) {
        console.error('Auth initialization error:', err);
        setLoading(false);
        return undefined;
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data?.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              full_name: fullName,
              plan: 'free',
              token_balance: 0,
              is_banned: false,
              verified: false,
            },
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          return { error: profileError };
        }
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign out failed') };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      return { error };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Password reset failed') };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};