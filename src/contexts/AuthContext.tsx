import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

type UserRole = 'dealer_principal' | 'general_manager' | 'marketing_manager' | 'controller' | 'admin';

interface Profile {
  id: string;
  user_id: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface Organization {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  market_size: 'small' | 'mid_size' | 'large';
  inventory_count: number;
  avg_front_gross: number;
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
  crm_dms_name?: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  userRole: UserRole | null | undefined;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, dealershipName?: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const log = logger('Auth');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserId = useRef<string | null>(null);

  const fetchUserData = async (userId: string, force = false) => {
    if (!force && lastFetchedUserId.current === userId && userRole !== undefined) {
      return;
    }
    lastFetchedUserId.current = userId;
    setUserRole(undefined);
    try {
      // Fetch profile and role in parallel to reduce sequential roundtrip latencies
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      const profileData = profileResult.data;
      const profileError = profileResult.error;
      const roleData = roleResult.data;
      const roleError = roleResult.error;

      if (profileError) {
        log.error('Failed to fetch profile', profileError);
      } else if (profileData) {
        setProfile(profileData as Profile);

        // Fetch organization if user has one
        if (profileData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .maybeSingle();

          if (orgError) {
            log.error('Failed to fetch organization', orgError);
          } else if (orgData) {
            setOrganization(orgData as Organization);
          }
        }
      }

      if (roleError) {
        log.error('Failed to fetch user role', roleError);
        setUserRole(null);
      } else if (roleData) {
        setUserRole(roleData.role as UserRole);
      } else {
        setUserRole(null);
      }
    } catch (error) {
      log.error('Error in fetchUserData', error);
      setUserRole(null);
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Once the listener fires, skip the getSession fallback
        initialSessionHandled = true;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchUserData(session.user.id);
        } else {
          lastFetchedUserId.current = null;
          setProfile(null);
          setOrganization(null);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session (fallback if listener hasn't fired yet)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialSessionHandled) return; // listener already handled it
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    dealershipName?: string,
    role?: UserRole
  ) => {
    const redirectUrl = `${window.location.origin}/onboarding`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          dealership_name: dealershipName,
          role: role,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/app/dashboard`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    lastFetchedUserId.current = null;
    setProfile(null);
    setOrganization(null);
    setUserRole(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id, true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        userRole,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
